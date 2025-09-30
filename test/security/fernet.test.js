// test/security/fernet.test.js - Fernet encryption tests
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { Fernet, encryptApiKey, decryptApiKey, verifyEncryptedCredentials } from '../../src/security/fernet.js';

describe('Fernet Encryption', () => {
  const testKeyPath = './test-secret.key';
  const testApiKey = 'test-api-key-12345';

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testKeyPath)) {
      fs.unlinkSync(testKeyPath);
    }
  });

  describe('Fernet class', () => {
    it('should generate a valid key', () => {
      const key = Fernet.generateKey();
      
      expect(typeof key).toBe('string');
      expect(Buffer.from(key, 'base64').length).toBe(32);
    });

    it('should encrypt and decrypt data correctly', () => {
      const key = Fernet.generateKey();
      const fernet = new Fernet(key);
      const plaintext = 'Hello, World!';

      const encrypted = fernet.encrypt(plaintext);
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(plaintext);

      const decrypted = fernet.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should throw error for invalid key length', () => {
      const invalidKey = Buffer.from('short-key').toString('base64');
      
      expect(() => new Fernet(invalidKey)).toThrow('Fernet key must be 32 bytes');
    });

    it('should throw error for invalid token', () => {
      const key = Fernet.generateKey();
      const fernet = new Fernet(key);
      
      expect(() => fernet.decrypt('invalid-token')).toThrow();
    });

    it('should enforce TTL when specified', () => {
      const key = Fernet.generateKey();
      const fernet = new Fernet(key);
      const plaintext = 'test-data';

      // Create token with past timestamp (simulate old token)
      const token = fernet.encrypt(plaintext);
      
      // This should work without TTL
      expect(() => fernet.decrypt(token)).not.toThrow();
      
      // This should fail with very short TTL
      expect(() => fernet.decrypt(token, 0)).toThrow('Token has expired');
    });

    it('should save and load keys from file', () => {
      const originalKey = Fernet.generateKey();
      Fernet.saveKey(testKeyPath, originalKey);
      
      expect(fs.existsSync(testKeyPath)).toBe(true);
      
      const fernet = Fernet.fromFile(testKeyPath);
      const plaintext = 'test-data';
      
      const encrypted = fernet.encrypt(plaintext);
      const decrypted = fernet.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('Utility functions', () => {
    it('should encrypt and decrypt API key', () => {
      const encrypted = encryptApiKey(testApiKey, testKeyPath);
      
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(testApiKey);
      expect(fs.existsSync(testKeyPath)).toBe(true);
      
      const decrypted = decryptApiKey(encrypted, testKeyPath);
      expect(decrypted).toBe(testApiKey);
    });

    it('should verify encrypted credentials', () => {
      const encrypted = encryptApiKey(testApiKey, testKeyPath);
      
      expect(verifyEncryptedCredentials(encrypted, testKeyPath)).toBe(true);
      expect(verifyEncryptedCredentials('invalid-token', testKeyPath)).toBe(false);
    });

    it('should handle missing key file gracefully', () => {
      expect(() => decryptApiKey('some-token', 'nonexistent-key.key'))
        .toThrow('Fernet key file not found');
    });

    it('should generate key if file does not exist during encryption', () => {
      const encrypted = encryptApiKey(testApiKey, testKeyPath);
      
      expect(fs.existsSync(testKeyPath)).toBe(true);
      expect(typeof encrypted).toBe('string');
      
      // Verify we can decrypt it
      const decrypted = decryptApiKey(encrypted, testKeyPath);
      expect(decrypted).toBe(testApiKey);
    });
  });

  describe('Error handling', () => {
    it('should handle malformed encrypted data', () => {
      // Create a valid key file first
      const key = Fernet.generateKey();
      fs.writeFileSync(testKeyPath, key);
      
      expect(() => decryptApiKey('not-base64!@#', testKeyPath))
        .toThrow('Failed to decrypt API key');
    });

    it('should handle corrupted key file', () => {
      fs.writeFileSync(testKeyPath, 'corrupted-key-data');
      
      expect(() => decryptApiKey('gAAAAABhZ5K5', testKeyPath))
        .toThrow('Failed to decrypt API key');
    });
  });

  describe('Security features', () => {
    it('should produce different tokens for same plaintext', () => {
      const key = Fernet.generateKey();
      const fernet = new Fernet(key);
      const plaintext = 'same-data';

      const token1 = fernet.encrypt(plaintext);
      const token2 = fernet.encrypt(plaintext);
      
      // Tokens should be different due to random IV
      expect(token1).not.toBe(token2);
      
      // But both should decrypt to same plaintext
      expect(fernet.decrypt(token1)).toBe(plaintext);
      expect(fernet.decrypt(token2)).toBe(plaintext);
    });

    it('should reject tokens with invalid signatures', () => {
      const key = Fernet.generateKey();
      const fernet = new Fernet(key);
      const token = fernet.encrypt('test-data');
      
      // Corrupt the signature (last 32 bytes)
      const tokenBuffer = Buffer.from(token, 'base64');
      tokenBuffer[tokenBuffer.length - 1] = tokenBuffer[tokenBuffer.length - 1] ^ 1;
      const corruptedToken = tokenBuffer.toString('base64');
      
      expect(() => fernet.decrypt(corruptedToken))
        .toThrow('Invalid token signature');
    });
  });
});