/**
 * UAV Dashboard Server - Security & Performance Tests
 * 
 * Comprehensive test suite covering:
 * - Security vulnerabilities testing
 * - Performance and load testing  
 * - API endpoint validation
 * - WebSocket communication testing
 * - Circuit breaker functionality
 * - Memory leak detection
 * 
 * @author KRTI Team
 * @version 3.1.0
 */

const request = require('supertest');
const socketClient = require('socket.io-client');
const { app, server, serverState, logger, CONFIG } = require('./server_fixed');

describe('UAV Dashboard Server - Security & Performance Tests', () => {
    let socketUrl;
    let clientSocket;
    
    beforeAll(async () => {
        socketUrl = `http://localhost:${CONFIG.PORT}`;
        await new Promise(resolve => {
            server.listen(CONFIG.PORT, resolve);
        });
    });
    
    afterAll(async () => {
        if (clientSocket) {
            clientSocket.close();
        }
        server.close();
    });
    
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // =================================================================
    // SECURITY TESTS
    // =================================================================
    
    describe('🔒 Security Tests', () => {
        
        test('CORS should reject unauthorized origins', async () => {
            const response = await request(app)
                .get('/api/health')
                .set('Origin', 'https://malicious-site.com')
                .expect(500);
            
            expect(response.text).toContain('Not allowed by CORS');
        });
        
        test('CORS should allow whitelisted origins', async () => {
            const response = await request(app)
                .get('/api/health')
                .set('Origin', 'http://localhost:3003')
                .expect(200);
            
            expect(response.body.status).toBe('healthy');
        });
        
        test('Rate limiting should block excessive requests', async () => {
            const promises = [];
            
            // Send more requests than the limit
            for (let i = 0; i < CONFIG.SECURITY.RATE_LIMIT_MAX + 5; i++) {
                promises.push(request(app).get('/api/health'));
            }
            
            const responses = await Promise.all(promises);
            const rateLimitedResponses = responses.filter(r => r.status === 429);
            
            expect(rateLimitedResponses.length).toBeGreaterThan(0);
        });
        
        test('Input validation should reject invalid telemetry data', async () => {
            const invalidData = {
                battery_voltage: 999, // Out of range (max 50)
                battery_current: 'invalid_string',
                malicious_script: '<script>alert("xss")</script>'
            };
            
            const response = await request(app)
                .post('/api/telemetry')
                .send(invalidData)
                .expect(400);
            
            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Invalid telemetry data');
        });
        
        test('Input validation should accept valid telemetry data', async () => {
            const validData = {
                battery_voltage: 14.8,
                battery_current: 5.2,
                battery_power: 76.96,
                temperature: 25.5,
                humidity: 65.0,
                gps_latitude: -6.200000,
                gps_longitude: 106.816666
            };
            
            const response = await request(app)
                .post('/api/telemetry')
                .send(validData)
                .expect(200);
            
            expect(response.body.success).toBe(true);
        });
        
        test('Command validation should reject invalid commands', async () => {
            const invalidCommand = {
                command: 'malicious_command',
                action: 'hack_system',
                value: { evil: 'payload' }
            };
            
            const response = await request(app)
                .post('/api/command')
                .send(invalidCommand)
                .expect(400);
            
            expect(response.body.success).toBe(false);
        });
        
        test('Payload size limit should be enforced', async () => {
            const largePayload = {
                battery_voltage: 12.5,
                large_data: 'x'.repeat(CONFIG.TELEMETRY.MAX_PAYLOAD_SIZE + 100)
            };
            
            const response = await request(app)
                .post('/api/telemetry')
                .send(largePayload)
                .expect(413);
        });
        
        test('Security headers should be present', async () => {
            const response = await request(app)
                .get('/api/health')
                .expect(200);
            
            expect(response.headers['x-content-type-options']).toBe('nosniff');
            expect(response.headers['x-frame-options']).toBe('DENY');
            expect(response.headers['x-xss-protection']).toBe('1; mode=block');
        });
    });

    // =================================================================
    // PERFORMANCE TESTS
    // =================================================================
    
    describe('⚡ Performance Tests', () => {
        
        test('API response time should be under 100ms', async () => {
            const startTime = Date.now();
            
            await request(app)
                .get('/api/health')
                .expect(200);
            
            const responseTime = Date.now() - startTime;
            expect(responseTime).toBeLessThan(100);
        });
        
        test('Concurrent requests should be handled efficiently', async () => {
            const concurrentRequests = 50;
            const promises = [];
            
            const startTime = Date.now();
            
            for (let i = 0; i < concurrentRequests; i++) {
                promises.push(request(app).get('/api/telemetry'));
            }
            
            const responses = await Promise.all(promises);
            const totalTime = Date.now() - startTime;
            
            // All requests should succeed
            responses.forEach(response => {
                expect(response.status).toBe(200);
            });
            
            // Should complete within reasonable time
            expect(totalTime).toBeLessThan(5000); // 5 seconds
        });
        
        test('Memory usage should stay within limits', async () => {
            const initialMemory = process.memoryUsage().heapUsed;
            
            // Generate load
            for (let i = 0; i < 100; i++) {
                await request(app)
                    .post('/api/telemetry')
                    .send({
                        battery_voltage: 12.5 + Math.random(),
                        battery_current: 5.0 + Math.random(),
                        temperature: 25 + Math.random() * 10
                    });
            }
            
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
            
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
            
            // Memory increase should be reasonable (< 50MB for 100 requests)
            expect(memoryIncrease).toBeLessThan(50);
        });
    });

    // =================================================================
    // API ENDPOINT TESTS
    // =================================================================
    
    describe('🛡️ API Endpoint Tests', () => {
        
        test('Health endpoint should return system status', async () => {
            const response = await request(app)
                .get('/api/health')
                .expect(200);
            
            expect(response.body).toHaveProperty('status');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('uptime');
            expect(response.body).toHaveProperty('memory');
            expect(response.body).toHaveProperty('connections');
        });
        
        test('Stats endpoint should return comprehensive statistics', async () => {
            const response = await request(app)
                .get('/api/stats')
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body).toHaveProperty('server');
            expect(response.body).toHaveProperty('connections');
            expect(response.body).toHaveProperty('telemetry');
            expect(response.body).toHaveProperty('performance');
        });
        
        test('Telemetry endpoint should return current data', async () => {
            const response = await request(app)
                .get('/api/telemetry')
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body).toHaveProperty('data');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('stats');
        });
        
        test('Dashboard should serve static files', async () => {
            const response = await request(app)
                .get('/')
                .expect(200);
            
            expect(response.headers['content-type']).toContain('text/html');
        });
        
        test('Non-existent endpoints should return 404', async () => {
            await request(app)
                .get('/api/nonexistent')
                .expect(404);
        });
    });

    // =================================================================
    // WEBSOCKET TESTS
    // =================================================================
    
    describe('🔌 WebSocket Tests', () => {
        
        beforeEach(() => {
            clientSocket = socketClient(socketUrl, {
                forceNew: true,
                transports: ['websocket']
            });
        });
        
        afterEach(() => {
            if (clientSocket) {
                clientSocket.close();
                clientSocket = null;
            }
        });
        
        test('Socket connection should be established', (done) => {
            clientSocket.on('connect', () => {
                expect(clientSocket.connected).toBe(true);
                done();
            });
        });
        
        test('Telemetry updates should be broadcasted', (done) => {
            let updateReceived = false;
            
            clientSocket.on('connect', () => {
                // Listen for telemetry updates
                clientSocket.on('telemetryUpdate', (data) => {
                    if (!updateReceived) {
                        updateReceived = true;
                        expect(data).toHaveProperty('battery_voltage');
                        expect(data).toHaveProperty('timestamp');
                        done();
                    }
                });
                
                // Send telemetry data via HTTP to trigger broadcast
                setTimeout(() => {
                    request(app)
                        .post('/api/telemetry')
                        .send({
                            battery_voltage: 15.2,
                            battery_current: 4.8,
                            temperature: 26.5
                        })
                        .end();
                }, 100);
            });
        });
        
        test('Command relay should work properly', (done) => {
            clientSocket.on('connect', () => {
                // Listen for commands
                clientSocket.on('esp32Command', (commandData) => {
                    expect(commandData).toHaveProperty('command');
                    expect(commandData).toHaveProperty('timestamp');
                    expect(commandData).toHaveProperty('source');
                    done();
                });
                
                // Send command
                setTimeout(() => {
                    request(app)
                        .post('/api/command')
                        .send({
                            command: 'relay',
                            action: 'on',
                            device_id: 'test_device'
                        })
                        .end();
                }, 100);
            });
        });
        
        test('ESP32 device connection should be tracked', (done) => {
            clientSocket.on('connect', () => {
                // Simulate ESP32 connection
                clientSocket.emit('esp32Connect', {
                    deviceId: 'test_esp32',
                    version: '1.0.0',
                    type: 'UAV'
                });
                
                // Check connection status
                setTimeout(async () => {
                    const response = await request(app)
                        .get('/api/stats')
                        .expect(200);
                    
                    expect(response.body.connections.esp32DeviceCount).toBeGreaterThan(0);
                    done();
                }, 200);
            });
        });
        
        test('Connection rate limiting should be enforced', (done) => {
            const connections = [];
            let rejectedConnections = 0;
            
            // Attempt to create more connections than allowed
            for (let i = 0; i < CONFIG.SECURITY.MAX_CONNECTIONS_PER_IP + 5; i++) {
                const socket = socketClient(socketUrl, {
                    forceNew: true,
                    transports: ['websocket']
                });
                
                socket.on('connect', () => {
                    connections.push(socket);
                });
                
                socket.on('connect_error', () => {
                    rejectedConnections++;
                    socket.close();
                });
            }
            
            setTimeout(() => {
                expect(rejectedConnections).toBeGreaterThan(0);
                
                // Clean up connections
                connections.forEach(socket => socket.close());
                done();
            }, 1000);
        });
    });

    // =================================================================
    // CIRCUIT BREAKER TESTS
    // =================================================================
    
    describe('🔄 Circuit Breaker Tests', () => {
        
        test('Circuit breaker should open after failures', async () => {
            // First, check initial health
            let response = await request(app)
                .get('/api/health')
                .expect(200);
            
            const initialStats = response.body.circuitBreakers;
            
            // Simulate failures by sending invalid data repeatedly
            for (let i = 0; i < 6; i++) {
                await request(app)
                    .post('/api/telemetry')
                    .send({ invalid: 'data' })
                    .expect(400);
            }
            
            // Check if circuit breaker opened
            response = await request(app)
                .get('/api/health')
                .expect(200);
            
            const finalStats = response.body.circuitBreakers;
            
            // Should have more failures than initial
            expect(finalStats.telemetry.failedRequests).toBeGreaterThan(
                initialStats.telemetry.failedRequests
            );
        });
    });

    // =================================================================
    // DEDUPLICATION TESTS  
    // =================================================================
    
    describe('🔄 Deduplication Tests', () => {
        
        test('Duplicate packets should be detected and ignored', async () => {
            const telemetryData = {
                battery_voltage: 14.5,
                battery_current: 5.0,
                packet_number: 12345,
                device_id: 'test_device'
            };
            
            // Send same packet twice
            const response1 = await request(app)
                .post('/api/telemetry')
                .send(telemetryData)
                .expect(200);
            
            const response2 = await request(app)
                .post('/api/telemetry')
                .send(telemetryData)
                .expect(200);
            
            expect(response1.body.success).toBe(true);
            expect(response2.body.duplicate).toBe(true);
        });
        
        test('Non-duplicate packets should be processed', async () => {
            const telemetryData1 = {
                battery_voltage: 14.5,
                packet_number: 12346,
                device_id: 'test_device'
            };
            
            const telemetryData2 = {
                battery_voltage: 14.6,
                packet_number: 12347,
                device_id: 'test_device'
            };
            
            const response1 = await request(app)
                .post('/api/telemetry')
                .send(telemetryData1)
                .expect(200);
            
            const response2 = await request(app)
                .post('/api/telemetry')
                .send(telemetryData2)
                .expect(200);
            
            expect(response1.body.success).toBe(true);
            expect(response2.body.success).toBe(true);
            expect(response1.body.duplicate).toBeUndefined();
            expect(response2.body.duplicate).toBeUndefined();
        });
    });

    // =================================================================
    // STRESS TESTS
    // =================================================================
    
    describe('💪 Stress Tests', () => {
        
        test('Server should handle high frequency telemetry data', async () => {
            const promises = [];
            const startTime = Date.now();
            
            for (let i = 0; i < 200; i++) {
                promises.push(
                    request(app)
                        .post('/api/telemetry')
                        .send({
                            battery_voltage: 12.0 + Math.random() * 5,
                            battery_current: 3.0 + Math.random() * 4,
                            packet_number: i,
                            device_id: `device_${i % 5}`
                        })
                );
            }
            
            const responses = await Promise.all(promises);
            const duration = Date.now() - startTime;
            
            // Should complete within 10 seconds
            expect(duration).toBeLessThan(10000);
            
            // Most requests should succeed
            const successfulResponses = responses.filter(r => r.body.success === true);
            expect(successfulResponses.length).toBeGreaterThan(150);
        });
        
        test('Memory should not leak during sustained load', async () => {
            const initialMemory = process.memoryUsage().heapUsed;
            
            // Sustained load for 30 requests
            for (let batch = 0; batch < 3; batch++) {
                const promises = [];
                
                for (let i = 0; i < 10; i++) {
                    promises.push(
                        request(app)
                            .post('/api/telemetry')
                            .send({
                                battery_voltage: 13.5,
                                battery_current: 4.2,
                                temperature: 25 + Math.random() * 5
                            })
                    );
                }
                
                await Promise.all(promises);
                
                // Wait a bit between batches
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
            
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;
            
            // Memory increase should be minimal (< 20MB)
            expect(memoryIncrease).toBeLessThan(20);
        });
    });

    // =================================================================
    // ERROR HANDLING TESTS
    // =================================================================
    
    describe('⚠️ Error Handling Tests', () => {
        
        test('Invalid JSON should be handled gracefully', async () => {
            const response = await request(app)
                .post('/api/telemetry')
                .send('{ invalid json }')
                .expect(400);
        });
        
        test('Missing required fields should be rejected', async () => {
            const response = await request(app)
                .post('/api/telemetry')
                .send({})
                .expect(400);
            
            expect(response.body.success).toBe(false);
        });
        
        test('Server errors should be logged properly', async () => {
            const logSpy = jest.spyOn(logger, 'error');
            
            // Send malformed data to trigger error
            await request(app)
                .post('/api/telemetry')
                .send({ battery_voltage: 'not_a_number' })
                .expect(400);
            
            expect(logSpy).toHaveBeenCalled();
        });
    });
});

// =================================================================
// TEST UTILITIES
// =================================================================

describe('🔧 Test Utilities', () => {
    
    test('Test environment should be properly configured', () => {
        expect(process.env.NODE_ENV).toBeDefined();
        expect(CONFIG).toBeDefined();
        expect(CONFIG.PORT).toBeDefined();
        expect(CONFIG.SECURITY).toBeDefined();
    });
    
    test('All required modules should be loaded', () => {
        expect(app).toBeDefined();
        expect(server).toBeDefined();
        expect(serverState).toBeDefined();
        expect(logger).toBeDefined();
    });
});

module.exports = {
    describe,
    test,
    expect,
    beforeAll,
    afterAll,
    beforeEach,
    afterEach
};
