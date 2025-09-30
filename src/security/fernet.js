// fernet.js — Node.js implementation of Fernet encryption (compatible with Python's cryptography library)
import crypto from 'crypto';
import fs from 'fs';

const FERNET_TOKEN_VERSION = 0x80;
const FERNET_AES_BLOCK_SIZE = 16;
const FERNET_KEY_SIZE = 32;
const FERNET_MAC_SIZE = 32;

/**
 * Node.js Fernet encryption/decryption implementation
 * Compatible with Python's cryptography.fernet.Fernet
 */
export class Fernet {
  constructor(key) {
    if (typeof key === 'string') {
      this.key = Buffer.from(key, 'base64');
    } else {
      this.key = key;
    }
    
    if (this.key.length !== FERNET_KEY_SIZE) {
      throw new Error('Fernet key must be 32 bytes (256 bits)');
    }
    
    this.signingKey = this.key.slice(0, 16);
    this.encryptionKey = this.key.slice(16, 32);
  }
  
  /**
   * Encrypt plaintext data
   * @param {string|Buffer} data - Data to encrypt
   * @returns {string} - Base64 encoded Fernet token
   */
  encrypt(data) {
    const plaintext = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    const timestamp = Math.floor(Date.now() / 1000);
    const iv = crypto.randomBytes(FERNET_AES_BLOCK_SIZE);
    
    // Create cipher
    const cipher = crypto.createCipherGCM('aes-128-cbc', this.encryptionKey);
    cipher.setAutoPadding(true);
    
    // Encrypt data
    let encrypted = cipher.update(plaintext);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    // Create token structure: version (1) + timestamp (8) + iv (16) + ciphertext + hmac (32)
    const tokenData = Buffer.concat([
      Buffer.from([FERNET_TOKEN_VERSION]),
      this._packTimestamp(timestamp),
      iv,
      encrypted
    ]);
    
    // Generate HMAC
    const hmac = crypto.createHmac('sha256', this.signingKey);
    hmac.update(tokenData);
    const signature = hmac.digest();
    
    // Combine everything
    const token = Buffer.concat([tokenData, signature]);
    
    return token.toString('base64');
  }
  
  /**
   * Decrypt Fernet token
   * @param {string} token - Base64 encoded Fernet token
   * @param {number} ttl - Time-to-live in seconds (optional)
   * @returns {string} - Decrypted plaintext
   */
  decrypt(token, ttl = null) {
    const tokenBuffer = Buffer.from(token, 'base64');
    
    if (tokenBuffer.length < 57) { // Minimum token size
      throw new Error('Invalid token length');
    }
    
    // Extract components
    const version = tokenBuffer[0];
    const timestamp = this._unpackTimestamp(tokenBuffer.slice(1, 9));
    const iv = tokenBuffer.slice(9, 25);
    const ciphertext = tokenBuffer.slice(25, -32);
    const signature = tokenBuffer.slice(-32);
    
    if (version !== FERNET_TOKEN_VERSION) {
      throw new Error('Invalid token version');
    }
    
    // Verify HMAC
    const tokenData = tokenBuffer.slice(0, -32);
    const hmac = crypto.createHmac('sha256', this.signingKey);
    hmac.update(tokenData);
    const expectedSignature = hmac.digest();
    
    if (!crypto.timingSafeEqual(signature, expectedSignature)) {
      throw new Error('Invalid token signature');
    }
    
    // Check TTL if specified
    if (ttl !== null) {
      const currentTime = Math.floor(Date.now() / 1000);
      if (currentTime - timestamp > ttl) {
        throw new Error('Token has expired');
      }
    }
    
    // Decrypt
    try {
      const decipher = crypto.createDecipherGCM('aes-128-cbc', this.encryptionKey);
      decipher.setAutoPadding(true);
      
      let decrypted = decipher.update(ciphertext);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      return decrypted.toString('utf8');
    } catch (error) {
      throw new Error('Failed to decrypt token');
    }
  }
  
  /**
   * Generate a new Fernet key
   * @returns {string} - Base64 encoded key
   */
  static generateKey() {
    const key = crypto.randomBytes(FERNET_KEY_SIZE);
    return key.toString('base64');
  }
  
  /**
   * Load Fernet key from file
   * @param {string} filePath - Path to key file
   * @returns {Fernet} - Fernet instance
   */
  static fromFile(filePath) {
    const keyData = fs.readFileSync(filePath);
    return new Fernet(keyData);
  }
  
  /**
   * Save Fernet key to file
   * @param {string} filePath - Path to save key
   * @param {string} key - Base64 encoded key (optional, generates new if not provided)
   */
  static saveKey(filePath, key = null) {
    const keyToSave = key || Fernet.generateKey();
    fs.writeFileSync(filePath, keyToSave);
    return keyToSave;
  }
  
  // Helper methods
  _packTimestamp(timestamp) {
    const buffer = Buffer.allocUnsafe(8);
    buffer.writeBigUInt64BE(BigInt(timestamp), 0);
    return buffer;
  }
  
  _unpackTimestamp(buffer) {
    return Number(buffer.readBigUInt64BE(0));
  }
}

/**
 * Utility functions for easy encryption/decryption
 */

/**
 * Encrypt API key using Fernet
 * @param {string} apiKey - API key to encrypt
 * @param {string} keyPath - Path to Fernet key file
 * @returns {string} - Encrypted token
 */
export function encryptApiKey(apiKey, keyPath = './secret.key') {
  try {
    let key;
    
    if (fs.existsSync(keyPath)) {
      key = fs.readFileSync(keyPath, 'utf8').trim();
    } else {
      // Generate new key if file doesn't exist
      key = Fernet.generateKey();
      fs.writeFileSync(keyPath, key);
      console.log(`Generated new Fernet key: ${keyPath}`);
    }
    
    const fernet = new Fernet(key);
    return fernet.encrypt(apiKey);
  } catch (error) {
    throw new Error(`Failed to encrypt API key: ${error.message}`);
  }
}

/**
 * Decrypt API key using Fernet
 * @param {string} encryptedToken - Encrypted API key token
 * @param {string} keyPath - Path to Fernet key file
 * @param {number} ttl - Time-to-live in seconds (optional)
 * @returns {string} - Decrypted API key
 */
export function decryptApiKey(encryptedToken, keyPath = './secret.key', ttl = null) {
  try {
    if (!fs.existsSync(keyPath)) {
      throw new Error(`Fernet key file not found: ${keyPath}`);
    }
    
    const key = fs.readFileSync(keyPath, 'utf8').trim();
    const fernet = new Fernet(key);
    
    return fernet.decrypt(encryptedToken, ttl);
  } catch (error) {
    throw new Error(`Failed to decrypt API key: ${error.message}`);
  }
}

/**
 * Verify encrypted credentials by attempting decryption
 * @param {string} encryptedToken - Encrypted token to verify
 * @param {string} keyPath - Path to Fernet key file
 * @returns {boolean} - True if token is valid
 */
export function verifyEncryptedCredentials(encryptedToken, keyPath = './secret.key') {
  try {
    decryptApiKey(encryptedToken, keyPath);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Rotate encryption key (re-encrypt with new key)
 * @param {string} encryptedToken - Token encrypted with old key
 * @param {string} oldKeyPath - Path to old key
 * @param {string} newKeyPath - Path to new key
 * @returns {string} - Token encrypted with new key
 */
export function rotateEncryptionKey(encryptedToken, oldKeyPath, newKeyPath) {
  try {
    // Decrypt with old key
    const plaintext = decryptApiKey(encryptedToken, oldKeyPath);
    
    // Generate new key if needed
    if (!fs.existsSync(newKeyPath)) {
      const newKey = Fernet.generateKey();
      fs.writeFileSync(newKeyPath, newKey);
    }
    
    // Encrypt with new key
    return encryptApiKey(plaintext, newKeyPath);
  } catch (error) {
    throw new Error(`Failed to rotate encryption key: ${error.message}`);
  }
}

export default Fernet;