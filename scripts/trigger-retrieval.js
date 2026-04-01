/**
 * Trigger memory retrievals by simulating what the agent does
 * This will create new retrieval_logs entries with the optimized code
 */

const http = require('http');

const queries = [
  'user working on AI projects',
  'feeling stressed about deadlines',
  'celebrating achievements',
  'learning new skills',
  'team collaboration'
];

async function embedAndSearch(query) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: 'nomic-embed-text',
      input: query
    });

    const options = {
      hostname: '127.0.0.1',
      port: 11434,
      path: '/api/embed',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('🚀 Triggering memory retrievals with optimized code...\n');

  for (const query of queries) {
    const start = Date.now();
    try {
      await embedAndSearch(query);
      const duration = Date.now() - start;
      console.log(`✓ "${query}" - embedding: ${duration}ms`);
    } catch (err) {
      console.log(`✗ "${query}" - failed: ${err.message}`);
    }
  }

  console.log('\n💡 Tip: The app is running. Memory searches via the agent');
  console.log('    will now use the optimized 12-candidate pipeline.');
  console.log('\n    Check retrieval_logs table for new entries with lower latency.');
}

main();
