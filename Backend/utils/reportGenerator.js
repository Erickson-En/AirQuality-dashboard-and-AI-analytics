/**
 * Lightweight Report Generator - Returns formatted JSON/Text report
 * PDFKit removed due to installation issues - returns CLI-friendly text format
 */

class ReportGenerator {
  constructor(readings, location = 'Lab Sensor A') {
    this.readings = readings;
    this.location = location;
  }

  /**
   * Generate text report (no PDF dependencies)
   * @param {string} granularity - 'hourly', 'daily', 'weekly', 'monthly', 'yearly'
   * @param {Date} startDate
   * @param {Date} endDate
   * @returns {Object} Report data as JSON/text
   */
  async generateReport(granularity, startDate, endDate) {
    const aggregatedData = this._aggregateByGranularity(granularity);

    return {
      header: {
        title: 'Air Quality Report',
        type: granularity.charAt(0).toUpperCase() + granularity.slice(1),
        location: this.location,
        period: `${startDate.toDateString()} to ${endDate.toDateString()}`,
        generated: new Date().toLocaleString(),
      },
      executiveSummary: this._generateExecutiveSummary(aggregatedData),
      pollutantAnalysis: this._generatePollutantAnalysis(aggregatedData),
      environmental: this._generateEnvironmental(aggregatedData),
      healthCompliance: this._generateHealthCompliance(aggregatedData),
      sensorHealth: this._generateSensorHealth(),
    };
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

  _generateExecutiveSummary(aggregatedData) {
    const allAQI = this.readings.map((r) => r.aqi).filter((v) => v !== undefined);
    const avgAQI = allAQI.length ? (allAQI.reduce((a, b) => a + b) / allAQI.length).toFixed(1) : 'N/A';
    const maxAQI = allAQI.length ? Math.max(...allAQI) : 'N/A';
    const minAQI = allAQI.length ? Math.min(...allAQI) : 'N/A';

    return {
      averageAQI: avgAQI,
      peakAQI: maxAQI,
      lowestAQI: minAQI,
      totalReadings: this.readings.length,
      dataCompleteness: `${((this.readings.length / (24 * Object.keys(aggregatedData).length)) * 100).toFixed(0)}%`,
    };
  }

  _generatePollutantAnalysis(aggregatedData) {
    const pollutants = ['pm1', 'pm25', 'pm10', 'co', 'co2', 'o3', 'no2'];
    const analysis = {};

    pollutants.forEach((pollutant) => {
      const values = this.readings.map((r) => r[pollutant]).filter((v) => v !== undefined && v !== null);
      if (values.length === 0) return;

      const stats = this._getStats(values);
      analysis[pollutant.toUpperCase()] = {
        min: stats.min.toFixed(2),
        max: stats.max.toFixed(2),
        average: stats.mean.toFixed(2),
        median: stats.median.toFixed(2),
        standardDeviation: stats.std.toFixed(2),
        samples: values.length,
      };
    });

    return analysis;
  }

  _generateEnvironmental(aggregatedData) {
    const params = [
      { key: 'temperature', label: 'Temperature (°C)' },
      { key: 'humidity', label: 'Humidity (%)' },
      { key: 'voc_index', label: 'VOC Index' },
      { key: 'nox_index', label: 'NOx Index' },
    ];

    const environmental = {};
    params.forEach(({ key, label }) => {
      const values = this.readings.map((r) => r[key]).filter((v) => v !== undefined && v !== null);
      if (values.length === 0) return;

      const stats = this._getStats(values);
      environmental[label] = {
        min: stats.min.toFixed(2),
        max: stats.max.toFixed(2),
        average: stats.mean.toFixed(2),
      };
    });

    return environmental;
  }

  _generateHealthCompliance(aggregatedData) {
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

    const breakdown = {};
    Object.entries(healthCategories).forEach(([category, count]) => {
      const percentage = ((count / this.readings.length) * 100).toFixed(1);
      breakdown[category] = { count, percentage: `${percentage}%` };
    });

    return breakdown;
  }

  _generateSensorHealth() {
    const recentReadings = this.readings.slice(-10);
    const recentTimestamps = recentReadings.map((r) => new Date(r.timestamp).getTime());
    const timeDiffMs = Math.max(...recentTimestamps) - Math.min(...recentTimestamps);
    const timeDiffMin = Math.ceil(timeDiffMs / 60000);

    const nullFields = [];
    recentReadings.forEach((r) => {
      Object.keys(r).forEach((key) => {
        if ((r[key] === null || r[key] === undefined) && !nullFields.includes(key)) {
          nullFields.push(key);
        }
      });
    });

    return {
      lastReadingSpan: `${timeDiffMin} minutes`,
      latestTimestamp: recentReadings[recentReadings.length - 1]?.timestamp,
      missingFields: nullFields.length > 0 ? nullFields : 'None',
      status: nullFields.length > 0 ? '⚠ Warnings' : '✓ Healthy',
    };
  }
}

module.exports = ReportGenerator;

module.exports = ReportGenerator;
