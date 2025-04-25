const { spawn } = require('child_process');
const fs = require('fs'); // Correct import for createWriteStream
const fsPromises = require('fs').promises; // Import promises API separately
const path = require('path');
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout,
});

const RESULTS_DIR = 'results';

async function getPdfUrl(patentNumber) {
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
    const fullPath = path.join(__dirname, RESULTS_DIR, filename);
    console.log(`\x1b[33mDownloading ${filename} to ${RESULTS_DIR}...\x1b[0m`);
    const file = fs.createWriteStream(fullPath); // Save to results directory
    const curl = spawn('curl', ['-L', url]);
    let errorData = '';

    curl.stdout.pipe(file);

    curl.stderr.on('data', (data) => {
      errorData += data;
    });

    curl.on('error', (error) => {
      console.error(`\x1b[31mError downloading ${url}: ${error}\x1b[0m`);
      reject(error);
    });

    file.on('finish', () => {
      file.close();
      console.log(`\x1b[32mDownloaded ${filename} to ${RESULTS_DIR}\x1b[0m`);
      resolve();
    });

    file.on('error', (error) => {
      fsPromises.unlink(fullPath).catch(() => {}); // Use promises for unlink
      console.error(`\x1b[31mError writing to ${fullPath}: ${error}\x1b[0m`);
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

async function handlePatent(patentNumber) {
  try {
    const pdfUrl = await getPdfUrl(patentNumber);
    if (pdfUrl) {
      const filename = `${patentNumber}.pdf`;
      const resultsPath = path.join(__dirname, RESULTS_DIR, filename);
      if (await fsPromises.access(resultsPath).then(() => true).catch(() => false)) {
        console.log(`Skipping download of existing file in ${RESULTS_DIR}: ${filename}`);
        return false;
      }
      await downloadPdf(pdfUrl, filename);
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error(`Error processing ${patentNumber}:`, error);
    return false;
  }
}

async function processPatentFile(filename) {
  try {
    const fileContent = await fsPromises.readFile(filename, 'utf8');
    const patentNumbers = fileContent.split(',').map((p) => p.trim());
    const total = patentNumbers.length;
    let downloadedCount = 0;
    const notFound = [];

    // Ensure results directory exists
    if (!fs.existsSync(path.join(__dirname, RESULTS_DIR))) {
      await fsPromises.mkdir(path.join(__dirname, RESULTS_DIR), { recursive: true });
      console.log(`\x1b[32mCreated "${RESULTS_DIR}" directory.\x1b[0m`);
    }

    for (const patentNumber of patentNumbers) {
      const result = await handlePatent(patentNumber);
      if (result === true) {
        downloadedCount++;
      } else if (result === false) {
        notFound.push(patentNumber);
      }
      console.log(`\x1b[34m${downloadedCount}/${total} files processed.\x1b[0m`);
    }

    console.log('\x1b[32mAll files processed!\x1b[0m');
    console.log(`\x1b[32mDownloaded ${downloadedCount} out of ${total} attempted.\x1b[0m`);
    if (notFound.length > 0) {
      console.log('\x1b[31mThe following patent numbers could not be found on Google Patents:\x1b[0m', notFound);
    }

  } catch (error) {
    console.error('\x1b[31mError reading the file:\x1b[0m', error.message);
    process.exit(1); // Exit on file reading error
  } finally {
    readline.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    console.error('Usage: node patent_downloader_auto.js <patent_list_file.txt>');
    process.exit(1);
  }
  const filename = args[0];
  try {
    await fsPromises.access(filename);
    await processPatentFile(filename);
  } catch (error) {
    console.error('\x1b[31mError accessing the file:\x1b[0m', error.message);
    process.exit(1);
  }
}

main();