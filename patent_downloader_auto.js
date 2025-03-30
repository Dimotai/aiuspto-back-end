const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout,
});

const { spawn } = require('child_process');
const fs = require('fs');

function getPdfUrl(patentNumber) {

  return new Promise((resolve, reject) => {
    const url = `https://patents.google.com/patent/${patentNumber}`;
    let pdfUrl = null; // Variable to store the PDF URL
    
    console.log(`getPdfUrl: Starting curl for ${patentNumber}`); // Add this line
    const curlProcess = spawn('curl', [url], { maxBuffer: 1024 * 1024 * 10 });
    console.log(`getPdfUrl: curl process started for ${patentNumber}`); // Add this line

    curlProcess.on('error', (error) => {
      console.error(`Error executing curl for ${patentNumber}: ${error}`);
      reject(error);
    });

    curlProcess.stdout.on('data', (data) => {
      const pdfRegex =
        /https:\/\/patentimages\.storage\.googleapis\.com\/(.*?)\.pdf/g;
      const pdfMatch = pdfRegex.exec(data.toString());

      if (pdfMatch) {
        pdfUrl = pdfMatch[0]; // Store the found URL
      }
    });

    curlProcess.on('close', (code) => {
      console.log(`getPdfUrl: curl process closed for ${patentNumber}, code: ${code}`); // Add this line
      if (code !== 0) {
        console.error(
          `Error executing curl for ${patentNumber}: exit code ${code}`,
        );
        reject(new Error(`curl exited with code ${code}`));
      } else {
        if (pdfUrl) {
          resolve(pdfUrl); // Resolve with the found URL
        } else {
          console.log(`PDF URL not found for ${patentNumber}.`);
          resolve(null); // Resolve with null if no URL is found
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

    console.log(`downloadPdf: curl process started for ${filename}`); // Add this line

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
      console.log(`downloadPdf: Downloaded ${filename}`); // Add this line
      resolve();
    });

    file.on('error', (error) => {
      fs.unlink(filename, () => { });
      console.error(`\x1b[31mError writing to ${filename}: ${error}\x1b[0m`);
      reject(error);
    });

    curl.on('close', (code) => {
      console.log(`downloadPdf: curl process closed for ${filename}, code: ${code}`); // Add this line
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
          await downloadPdf(pdfUrl, filename);
          return filename; //return filename for stdout.
      }
      return null; // Return null if patent was not downloaded.
  } catch (error) {
      console.error(`Error processing ${patentNumber}:`, error);
      return null; //return null on error.
  }
} 

async function main() {
  console.log('main: process.argv:', process.argv); // Add this line
  const patentNumbers = process.argv.slice(2); // Get patent numbers from command-line arguments.
  const total = patentNumbers.length;
  let downloaded = 0;
  let downloadedFilenames = [];

  for (const patentNumber of patentNumbers) {
      const filename = await handlePatent(patentNumber);
      if (filename) {
          downloadedFilenames.push(filename);
          downloaded++;
          console.log(`\x1b[34m${downloaded}/${total} files downloaded.\x1b[0m`);
      }
  }

  console.log('\x1b[32mAll files processed!\x1b[0m');
  console.log(downloadedFilenames.join('\n')); //return the file names to standard out.
}

main();