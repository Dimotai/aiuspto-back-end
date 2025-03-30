// app.js
const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const cors = require('cors'); 

const app = express();
const port = 3000;

app.use(cors()); 
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Route to serve PDF files
app.get('/pdf/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = __dirname + '/' + filename; 

  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('PDF not found');
  }
});


function getPdfUrl(patentNumber) {
  return new Promise((resolve, reject) => {
    const url = `https://patents.google.com/patent/${patentNumber}`;
    let pdfUrl = null;

    const curlProcess = spawn('curl', [url], { maxBuffer: 1024 * 1024 * 10 });

    curlProcess.on('error', (error) => {
      console.error(`Error executing curl for ${patentNumber}: ${error}`);
      reject(error);
    });

    curlProcess.stdout.on('data', (data) => {
      const pdfRegex =
        /https:\/\/patentimages\.storage\.googleapis\.com\/(.*?)\.pdf/g;
      const pdfMatch = pdfRegex.exec(data.toString());

      if (pdfMatch) {
        pdfUrl = pdfMatch[0];
      }
    });

    curlProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(
          `Error executing curl for ${patentNumber}: exit code ${code}`,
        );
        reject(new Error(`curl exited with code ${code}`));
      } else {
        if (pdfUrl) {
          resolve(pdfUrl);
        } else {
          console.log(`PDF URL not found for ${patentNumber}.`);
          resolve(null);
        }
      }
    });
  });
}

async function downloadPdf(url, filename) {
  return new Promise((resolve, reject) => {
    console.log(`\x1b[33mDownloading ${filename}...\x1b[0m`);

    const file = fs.createWriteStream(filename);
    const curl = spawn('curl', ['-L', url]);

    curl.stdout.pipe(file);

    let errorData = '';

    curl.stderr.on('data', (data) => {
      errorData += data;
    });

    curl.on('error', (error) => {
      console.error(`\x1b[31mError downloading ${url}: ${error}\x1b[0m`);
      reject(error);
    });

    file.on('finish', () => {
      file.close();
      console.log(`\x1b[32mDownloaded ${filename}\x1b[0m`);
      resolve();
    });

    file.on('error', (error) => {
      fs.unlink(filename, () => { });
      console.error(`\x1b[31mError writing to ${filename}: ${error}\x1b[0m`);
      reject(error);
    });

    curl.on('close', (code) => {
      if (code !== 0) {
        const errorMessage = `curl exited with code ${code || 'null'}\nError output: ${errorData}`;
        reject(new Error(errorMessage));
      }
    });
  });
}

app.post('/download', async (req, res) => {
  const patentNumber = req.body.patentNumber;
  const filename = `${patentNumber}.pdf`;

  try {
    // Always send the initial URL to the frontend
    const initialUrl = `https://patents.google.com/patent/${patentNumber}`;
    res.json({ success: true, initialUrl });

    // Attempt to download the PDF, regardless of whether it exists
    try {
      const pdfUrl = await getPdfUrl(patentNumber);
      if (!pdfUrl) {
        return res.status(404).json({ success: false, error: 'PDF URL not found.' });
      }
      
      await downloadPdf(pdfUrl, filename); 
      res.json({ success: true, filename, message: 'PDF downloaded successfully!' });

    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, async () => {
  console.log(`Server listening on port ${port}`);
  const open = await import('open');
  await open.default(`http://localhost:${port}`);
});