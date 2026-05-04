const axios = require('axios');
const fs = require('fs');

async function testReport() {
  try {
    console.log('Fetching PDF report from backend...');
    
    const response = await axios.post('http://localhost:5000/api/analytics/generate-report', {
      granularity: 'daily',
      startDate: '2026-03-25T00:00:00Z',
      endDate: '2026-04-24T23:59:59Z'
    }, {
      responseType: 'arraybuffer'
    });

    // Save to file
    fs.writeFileSync('./test-report.pdf', response.data);
    console.log('✅ PDF Report generated successfully!');
    console.log(`📄 File saved: test-report.pdf (${response.data.length} bytes)`);
    
  } catch (err) {
    console.error('❌ Error:', err.response?.data?.error || err.message);
  }
}

testReport();
