// src/services/gcs.js - Google Cloud Storage service for report persistence
import fs from 'fs';
import path from 'path';

/**
 * GCS Service for uploading and downloading analytics reports
 * Supports both GCS (production) and MinIO (local development)
 * Note: @google-cloud/storage is optional - service works without it using local fallback
 */
class GCSService {
  constructor() {
    this.enabled = process.env.ENABLE_GCS === 'true';
    this.useMinIO = process.env.USE_MINIO === 'true';
    this.bucketName = process.env.GCS_BUCKET_NAME || 'last-hope-analytics';
    this.storage = null;
    
    if (this.enabled) {
      try {
        // Try to import @google-cloud/storage if available
        import('@google-cloud/storage').then(({ Storage }) => {
          if (this.useMinIO) {
            // MinIO configuration for local development
            this.storage = new Storage({
              projectId: 'local-dev',
              apiEndpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
              credentials: {
                client_email: process.env.MINIO_ACCESS_KEY || 'minioadmin',
                private_key: process.env.MINIO_SECRET_KEY || 'minioadmin'
              }
            });
          } else {
            // Google Cloud Storage configuration
            const keyFilename = process.env.GCS_KEY_FILE;
            this.storage = new Storage(keyFilename ? { keyFilename } : {});
          }
        }).catch(err => {
          console.warn('GCS library not available, using local storage:', err.message);
          this.enabled = false;
        });
      } catch (error) {
        console.warn('GCS library not available, using local storage');
        this.enabled = false;
      }
    }
  }

  /**
   * Upload a JSON report to GCS/MinIO
   * @param {string} reportId - Unique report identifier
   * @param {Object} data - Report data to upload
   * @returns {Promise<Object>} Upload result with public URL
   */
  async uploadJSON(reportId, data) {
    if (!this.enabled || !this.storage) {
      return { 
        success: false, 
        error: 'GCS is disabled',
        localPath: this._saveLocal(reportId, data, 'json')
      };
    }

    try {
      const bucket = this.storage.bucket(this.bucketName);
      const fileName = `reports/${reportId}.json`;
      const file = bucket.file(fileName);
      
      await file.save(JSON.stringify(data, null, 2), {
        contentType: 'application/json',
        metadata: {
          reportId,
          timestamp: new Date().toISOString(),
          type: 'analytics-report'
        }
      });

      const publicUrl = this.useMinIO 
        ? `${process.env.MINIO_ENDPOINT || 'http://localhost:9000'}/${this.bucketName}/${fileName}`
        : `https://storage.googleapis.com/${this.bucketName}/${fileName}`;

      return {
        success: true,
        reportId,
        fileName,
        publicUrl,
        bucket: this.bucketName
      };
    } catch (error) {
      console.error('GCS upload error:', error);
      return {
        success: false,
        error: error.message,
        localPath: this._saveLocal(reportId, data, 'json')
      };
    }
  }

  /**
   * Upload an Excel report to GCS/MinIO
   * @param {string} reportId - Unique report identifier
   * @param {Buffer} buffer - Excel file buffer
   * @returns {Promise<Object>} Upload result with public URL
   */
  async uploadExcel(reportId, buffer) {
    if (!this.enabled || !this.storage) {
      return {
        success: false,
        error: 'GCS is disabled',
        localPath: this._saveLocal(reportId, buffer, 'xlsx')
      };
    }

    try {
      const bucket = this.storage.bucket(this.bucketName);
      const fileName = `reports/${reportId}.xlsx`;
      const file = bucket.file(fileName);
      
      await file.save(buffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        metadata: {
          reportId,
          timestamp: new Date().toISOString(),
          type: 'analytics-report-excel'
        }
      });

      const publicUrl = this.useMinIO
        ? `${process.env.MINIO_ENDPOINT || 'http://localhost:9000'}/${this.bucketName}/${fileName}`
        : `https://storage.googleapis.com/${this.bucketName}/${fileName}`;

      return {
        success: true,
        reportId,
        fileName,
        publicUrl,
        bucket: this.bucketName
      };
    } catch (error) {
      console.error('GCS Excel upload error:', error);
      return {
        success: false,
        error: error.message,
        localPath: this._saveLocal(reportId, buffer, 'xlsx')
      };
    }
  }

  /**
   * Download a report from GCS/MinIO
   * @param {string} reportId - Unique report identifier
   * @returns {Promise<Object>} Downloaded report data
   */
  async downloadJSON(reportId) {
    if (!this.enabled || !this.storage) {
      return this._loadLocal(reportId, 'json');
    }

    try {
      const bucket = this.storage.bucket(this.bucketName);
      const fileName = `reports/${reportId}.json`;
      const file = bucket.file(fileName);
      
      const [exists] = await file.exists();
      if (!exists) {
        // Fallback to local if file doesn't exist in GCS
        return this._loadLocal(reportId, 'json');
      }

      const [contents] = await file.download();
      const data = JSON.parse(contents.toString());
      
      return {
        success: true,
        reportId,
        data,
        source: this.useMinIO ? 'minio' : 'gcs'
      };
    } catch (error) {
      console.error('GCS download error:', error);
      // Fallback to local storage
      return this._loadLocal(reportId, 'json');
    }
  }

  /**
   * List all reports in storage
   * @returns {Promise<Array>} List of report metadata
   */
  async listReports() {
    if (!this.enabled || !this.storage) {
      return this._listLocal();
    }

    try {
      const bucket = this.storage.bucket(this.bucketName);
      const [files] = await bucket.getFiles({ prefix: 'reports/' });
      
      return files.map(file => ({
        reportId: path.basename(file.name, path.extname(file.name)),
        fileName: file.name,
        size: file.metadata.size,
        created: file.metadata.timeCreated,
        updated: file.metadata.updated,
        contentType: file.metadata.contentType
      }));
    } catch (error) {
      console.error('GCS list error:', error);
      return this._listLocal();
    }
  }

  /**
   * Delete a report from storage
   * @param {string} reportId - Unique report identifier
   * @returns {Promise<Object>} Deletion result
   */
  async deleteReport(reportId) {
    if (!this.enabled || !this.storage) {
      return this._deleteLocal(reportId);
    }

    try {
      const bucket = this.storage.bucket(this.bucketName);
      
      // Delete both JSON and Excel versions if they exist
      const jsonFile = bucket.file(`reports/${reportId}.json`);
      const excelFile = bucket.file(`reports/${reportId}.xlsx`);
      
      await Promise.all([
        jsonFile.delete().catch(() => null),
        excelFile.delete().catch(() => null)
      ]);

      return {
        success: true,
        reportId,
        message: 'Report deleted successfully'
      };
    } catch (error) {
      console.error('GCS delete error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // === Private helper methods for local storage fallback ===

  _getLocalStoragePath() {
    const baseDir = process.env.LOCAL_STORAGE_PATH || './data/reports';
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    return baseDir;
  }

  _saveLocal(reportId, data, extension) {
    try {
      const localPath = path.join(this._getLocalStoragePath(), `${reportId}.${extension}`);
      const content = extension === 'json' ? JSON.stringify(data, null, 2) : data;
      fs.writeFileSync(localPath, content);
      return localPath;
    } catch (error) {
      console.error('Local save error:', error);
      return null;
    }
  }

  _loadLocal(reportId, extension) {
    try {
      const localPath = path.join(this._getLocalStoragePath(), `${reportId}.${extension}`);
      if (!fs.existsSync(localPath)) {
        return {
          success: false,
          error: 'Report not found in local storage',
          reportId
        };
      }

      const content = fs.readFileSync(localPath, 'utf-8');
      const data = extension === 'json' ? JSON.parse(content) : content;
      
      return {
        success: true,
        reportId,
        data,
        source: 'local'
      };
    } catch (error) {
      console.error('Local load error:', error);
      return {
        success: false,
        error: error.message,
        reportId
      };
    }
  }

  _listLocal() {
    try {
      const localPath = this._getLocalStoragePath();
      const files = fs.readdirSync(localPath);
      
      return files
        .filter(f => f.endsWith('.json') || f.endsWith('.xlsx'))
        .map(fileName => {
          const filePath = path.join(localPath, fileName);
          const stats = fs.statSync(filePath);
          
          return {
            reportId: path.basename(fileName, path.extname(fileName)),
            fileName,
            size: stats.size,
            created: stats.birthtime,
            updated: stats.mtime,
            contentType: fileName.endsWith('.json') ? 'application/json' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            source: 'local'
          };
        });
    } catch (error) {
      console.error('Local list error:', error);
      return [];
    }
  }

  _deleteLocal(reportId) {
    try {
      const localPath = this._getLocalStoragePath();
      const jsonPath = path.join(localPath, `${reportId}.json`);
      const excelPath = path.join(localPath, `${reportId}.xlsx`);
      
      let deleted = false;
      if (fs.existsSync(jsonPath)) {
        fs.unlinkSync(jsonPath);
        deleted = true;
      }
      if (fs.existsSync(excelPath)) {
        fs.unlinkSync(excelPath);
        deleted = true;
      }

      return {
        success: deleted,
        reportId,
        message: deleted ? 'Report deleted from local storage' : 'Report not found'
      };
    } catch (error) {
      console.error('Local delete error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
export const gcsService = new GCSService();

// Export class for testing
export default GCSService;
