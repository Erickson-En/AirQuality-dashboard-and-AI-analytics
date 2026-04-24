const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Color palette matching the frontend
const COLORS = {
  pm1: '#ec4899',
  pm25: '#f43f5e',
  pm10: '#fbbf24',
  temperature: '#3b82f6',
  humidity: '#06b6d4',
  co2: '#8b5cf6',
  co: '#10b981',
  o3: '#f97316',
  no2: '#ef4444',
  voc: '#6366f1',
  nox: '#d946ef',
};

// WHO/EPA thresholds
const THRESHOLDS = {
  pm25: { good: 12, moderate: 35, unhealthy: 75, veryUnhealthy: 150 },
  pm10: { good: 50, moderate: 100, unhealthy: 250, veryUnhealthy: 350 },
  o3: { good: 55, moderate: 70, unhealthy: 85, veryUnhealthy: 105 },
  no2: { good: 53, moderate: 100, unhealthy: 360, veryUnhealthy: 649 },
  co: { good: 4.4, moderate: 9.4, unhealthy: 12.4, veryUnhealthy: 15.4 },
  co2: { good: 400, moderate: 600, unhealthy: 1000, veryUnhealthy: 2000 },
};

class ReportGenerator {
  constructor(readings, location = 'Lab Sensor A') {
    this.readings = readings;
    this.location = location;
    this.doc = null;
    this.pageHeight = 792;
    this.pageWidth = 612;
  }

  /**
   * Generate PDF report
   * @param {string} granularity - 'hourly', 'daily', 'weekly', 'monthly', 'yearly'
   * @param {Date} startDate
   * @param {Date} endDate
   * @returns {Buffer} PDF buffer
   */
  async generateReport(granularity, startDate, endDate) {
    this.doc = new PDFDocument({ bufferPages: true, margin: 40 });

    // Aggregate readings by granularity
    const aggregatedData = this._aggregateByGranularity(granularity);

    // Generate sections
    this._generateHeader(granularity, startDate, endDate);
    this._generateExecutiveSummary(aggregatedData);
    this._generatePollutantAnalysis(aggregatedData);
    this._generateEnvironmental(aggregatedData);
    this._generateHealthCompliance(aggregatedData);
    this._generateSensorHealth();
    this._generateFooter();

    this.doc.end();

    // Convert to buffer
    return new Promise((resolve, reject) => {
      const chunks = [];
      this.doc.on('data', (chunk) => chunks.push(chunk));
      this.doc.on('end', () => resolve(Buffer.concat(chunks)));
      this.doc.on('error', reject);
    });
  }

  _aggregateByGranularity(granularity) {
    const aggregated = {};

    this.readings.forEach((reading) => {
      const date = new Date(reading.timestamp);
      let key;

      if (granularity === 'hourly') {
        key = date.toISOString().slice(0, 13);
      } else if (granularity === 'daily') {
        key = date.toISOString().slice(0, 10);
      } else if (granularity === 'weekly') {
        key = `Week ${Math.floor(date.getDate() / 7)}`;
      } else if (granularity === 'monthly') {
        key = date.toISOString().slice(0, 7);
      } else if (granularity === 'yearly') {
        key = date.getFullYear().toString();
      }

      if (!aggregated[key]) {
        aggregated[key] = [];
      }
      aggregated[key].push(reading);
    });

    return aggregated;
  }

  _getStats(values) {
    if (values.length === 0) return { min: 0, max: 0, mean: 0, median: 0, std: 0 };

    const sorted = [...values].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const mean = values.reduce((a, b) => a + b) / values.length;
    const median = sorted[Math.floor(sorted.length / 2)];

    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance);

    return { min, max, mean, median, std };
  }

  _generateHeader(granularity, startDate, endDate) {
    this.doc.fontSize(28).font('Helvetica-Bold').text('Air Quality Report', { align: 'center' });
    this.doc.fontSize(12).font('Helvetica').text(`${granularity.charAt(0).toUpperCase() + granularity.slice(1)} Report`, { align: 'center' });

    this.doc.moveDown(0.5);
    this.doc.fontSize(10).text(`Location: ${this.location}`, { align: 'center' });
    this.doc.fontSize(10).text(`Period: ${startDate.toDateString()} to ${endDate.toDateString()}`, { align: 'center' });
    this.doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });

    this.doc.moveTo(40, this.doc.y + 10).lineTo(572, this.doc.y + 10).stroke();
    this.doc.moveDown(1);
  }

  _generateExecutiveSummary(aggregatedData) {
    this.doc.fontSize(16).font('Helvetica-Bold').text('Executive Summary');
    this.doc.fontSize(10).font('Helvetica');

    const allAQI = this.readings.map((r) => r.aqi).filter((v) => v !== undefined);
    const avgAQI = allAQI.length ? (allAQI.reduce((a, b) => a + b) / allAQI.length).toFixed(1) : 'N/A';
    const maxAQI = allAQI.length ? Math.max(...allAQI) : 'N/A';
    const minAQI = allAQI.length ? Math.min(...allAQI) : 'N/A';

    this.doc.text(`Average AQI: ${avgAQI}`, { indent: 20 });
    this.doc.text(`Peak AQI: ${maxAQI}`, { indent: 20 });
    this.doc.text(`Lowest AQI: ${minAQI}`, { indent: 20 });
    this.doc.text(`Total readings: ${this.readings.length}`, { indent: 20 });
    this.doc.text(`Data completeness: ${((this.readings.length / (24 * Object.keys(aggregatedData).length)) * 100).toFixed(0)}%`, { indent: 20 });

    this.doc.moveDown(0.5);
  }

  _generatePollutantAnalysis(aggregatedData) {
    this.doc.fontSize(16).font('Helvetica-Bold').text('Pollutant Analysis');
    this.doc.fontSize(9).font('Helvetica');

    const pollutants = ['pm1', 'pm25', 'pm10', 'co', 'co2', 'o3', 'no2'];

    pollutants.forEach((pollutant) => {
      const values = this.readings.map((r) => r[pollutant]).filter((v) => v !== undefined && v !== null);
      if (values.length === 0) return;

      const stats = this._getStats(values);
      const threshold = THRESHOLDS[pollutant];

      this.doc.fontSize(11).font('Helvetica-Bold').text(pollutant.toUpperCase(), { indent: 20 });
      this.doc.fontSize(9).font('Helvetica');

      this.doc.text(
        `Min: ${stats.min.toFixed(2)} | Max: ${stats.max.toFixed(2)} | Avg: ${stats.mean.toFixed(2)} | Median: ${stats.median.toFixed(2)}`,
        { indent: 30 }
      );

      if (threshold) {
        const exceedances = values.filter((v) => v > threshold.moderate).length;
        const exceedanceRate = ((exceedances / values.length) * 100).toFixed(1);
        this.doc.text(`Time above moderate level: ${exceedanceRate}%`, { indent: 30 });
      }

      this.doc.moveDown(0.2);
    });

    this.doc.moveDown(0.5);
  }

  _generateEnvironmental(aggregatedData) {
    this.doc.fontSize(16).font('Helvetica-Bold').text('Environmental Parameters');
    this.doc.fontSize(9).font('Helvetica');

    const params = [
      { key: 'temperature', label: 'Temperature (°C)' },
      { key: 'humidity', label: 'Humidity (%)' },
      { key: 'voc_index', label: 'VOC Index' },
      { key: 'nox_index', label: 'NOx Index' },
    ];

    params.forEach(({ key, label }) => {
      const values = this.readings.map((r) => r[key]).filter((v) => v !== undefined && v !== null);
      if (values.length === 0) return;

      const stats = this._getStats(values);
      this.doc.fontSize(10).font('Helvetica-Bold').text(label, { indent: 20 });
      this.doc.fontSize(9).font('Helvetica').text(`Min: ${stats.min.toFixed(2)} | Max: ${stats.max.toFixed(2)} | Avg: ${stats.mean.toFixed(2)}`, {
        indent: 30,
      });
      this.doc.moveDown(0.2);
    });

    this.doc.moveDown(0.5);
  }

  _generateHealthCompliance(aggregatedData) {
    this.doc.fontSize(16).font('Helvetica-Bold').text('Health & Compliance Analysis');
    this.doc.fontSize(9).font('Helvetica');

    const healthCategories = {
      Good: 0,
      Moderate: 0,
      'Unhealthy for Sensitive': 0,
      Unhealthy: 0,
      'Very Unhealthy': 0,
      Hazardous: 0,
    };

    this.readings.forEach((r) => {
      const aqi = r.aqi;
      if (aqi <= 50) healthCategories.Good++;
      else if (aqi <= 100) healthCategories.Moderate++;
      else if (aqi <= 150) healthCategories['Unhealthy for Sensitive']++;
      else if (aqi <= 200) healthCategories.Unhealthy++;
      else if (aqi <= 300) healthCategories['Very Unhealthy']++;
      else healthCategories.Hazardous++;
    });

    Object.entries(healthCategories).forEach(([category, count]) => {
      const percentage = ((count / this.readings.length) * 100).toFixed(1);
      this.doc.text(`${category}: ${count} readings (${percentage}%)`, { indent: 20 });
    });

    this.doc.moveDown(0.5);
  }

  _generateSensorHealth() {
    this.doc.fontSize(16).font('Helvetica-Bold').text('Sensor Health Status');
    this.doc.fontSize(9).font('Helvetica');

    const recentReadings = this.readings.slice(-10);
    const recentTimestamps = recentReadings.map((r) => new Date(r.timestamp).getTime());
    const timeDiffMs = Math.max(...recentTimestamps) - Math.min(...recentTimestamps);
    const timeDiffMin = Math.ceil(timeDiffMs / 60000);

    this.doc.text(`Last 10 readings span: ${timeDiffMin} minutes`, { indent: 20 });
    this.doc.text(`Latest reading timestamp: ${new Date(recentReadings[recentReadings.length - 1]?.timestamp).toLocaleString()}`, { indent: 20 });

    const nullFields = [];
    recentReadings.forEach((r) => {
      Object.keys(r).forEach((key) => {
        if ((r[key] === null || r[key] === undefined) && !nullFields.includes(key)) {
          nullFields.push(key);
        }
      });
    });

    if (nullFields.length > 0) {
      this.doc.text(`⚠ Missing data fields: ${nullFields.join(', ')}`, { indent: 20 });
    } else {
      this.doc.text('✓ All sensor data fields present', { indent: 20 });
    }

    this.doc.moveDown(0.5);
  }

  _generateFooter() {
    const totalPages = this.doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      this.doc.switchToPage(i);
      this.doc.fontSize(8).text(`Page ${i + 1} of ${totalPages}`, 50, this.pageHeight - 30, { align: 'center' });
      this.doc.text('Air Quality Dashboard System', { align: 'center' });
    }
  }
}

module.exports = ReportGenerator;
