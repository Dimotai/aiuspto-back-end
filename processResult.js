/*

Dependencies:
AWS SDK (npm install)
.env (AWS Secret ID + Key)

Results are stored in local directory and in /results
Prompts are stored in /prompts

COMPLETED FUNCTIONS

System fetches xml file from PDF for comprehensive analysis
System connects to AWS model (mutable)
System sends prompts (AIUSPTO-6 TO 10) with xml file text as source
AWS returns results under file input name + _results.txt
System copies results to /results

TO/DO

processResult.js currently scans directory for input file (.txt or .xml). Need to verify online sources of xml files to allow
integration of curl/pull xml file from PDF patent file name. This allows seamless PDF front-end GUI display capability in
congruency to back-end text-format-supported processing.
Integrate with front-end (independent)


NOTES

Claude provides slightly altered (formatting and quality of information) responses every request. Percentage-wise, I'd rate the
accuracy between responses anywhere from 70-90%. Consider consistently testing with higher-quality AI models.


*/

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
});

async function processWithBedrock(inputText) {
    try {
        const AWS = require('aws-sdk');
        AWS.config.update({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION,
        });

        const bedrockRuntime = new AWS.BedrockRuntime();

        const params = {
            modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify({
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: inputText,
                            },
                        ],
                    },
                ],
                max_tokens: 4096,
                temperature: 0.5,
                top_p: 0.9,
                anthropic_version: 'bedrock-2023-05-31',
            }),
        };

        const response = await bedrockRuntime.invokeModel(params).promise();
        const responseBody = JSON.parse(response.body);
        return responseBody.content[0].text;
    } catch (err) {
        console.error("Bedrock invocation error:", err);
        throw err;
    }
}

async function copyResultToResultsFolder(filename) {
    const resultsDir = 'results';

    try {
        if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir);
            console.log(`INFO: Created "${resultsDir}" directory.`);
        }

        const sourcePath = filename;
        const destPath = path.join(resultsDir, filename);

        fs.copyFileSync(sourcePath, destPath);
        console.log(`INFO: Copied "${filename}" to "${resultsDir}" folder.`);

    } catch (error) {
        console.error(`ERROR: Could not copy "${filename}" to "${resultsDir}":`, error);
    }
}

async function runPatentDownloader(searchResultFilename) {
    const downloaderScript = 'patent_downloader_auto.js';
    const downloaderPath = path.join(__dirname, downloaderScript);

    if (!fs.existsSync(downloaderPath)) {
        console.error(`ERROR: Required dependency ${downloaderScript} not found.`);
        readline.close();
        return;
    }

    console.log(`INFO: Running ${downloaderScript} with results from "${searchResultFilename}".`);

    try {
        const childProcess = spawn('node', [downloaderPath, searchResultFilename], {
            stdio: 'inherit', // Pipe stdio of the child process to the current process
        });

        childProcess.on('close', (code) => {
            if (code === 0) {
                console.log(`INFO: ${downloaderScript} completed successfully.`);
            } else {
                console.error(`ERROR: ${downloaderScript} exited with code ${code}.`);
            }
            readline.close();
        });

        childProcess.on('error', (err) => {
            console.error(`ERROR: Failed to start ${downloaderScript}:`, err);
            readline.close();
        });
    } catch (error) {
        console.error(`ERROR: Error running ${downloaderScript}:`, error);
        readline.close();
    }
}

async function runPatentSearch(resultsFilename) {
  try {
      const searchContent = fs.readFileSync(resultsFilename, 'utf-8');
      console.log(`INFO: Reading results for patent search from "${resultsFilename}".`);
      const patentSearchPrompt = `

      Attached is a comprehensive description of patent analysis in JSON format. Analyize further and extract all US-related patents (i.e. US 4,458,876 or 2014/0183381) that are mentioned in this JSON description.

      List ALL patents that are mentioned and format them following the rules mentioned below:

      Remove all spaces, commas, or slashes separating within the patent name itself. The result should only contain letters (typically "US") and numbers following. For example, "US 4,458,876" would just be "US4458876"
      If the number does not have US in front of it already, then add US. For example, "2014/0183381" would be "US20140183381"

      With the list of all patents, compile them into a giant string, separated by commas between each patent. Print the result without a description you (the model) provides describing the result; the result needs to be compatible to be directly copy and pasted into a functioning script.
      `;
      const bedrockSearchResult = await processWithBedrock(patentSearchPrompt + searchContent);
      const searchResultFilename = resultsFilename.replace('_result.txt', '_patent_search_result.txt');

      // Write the Bedrock search result to the file
      fs.writeFileSync(searchResultFilename, bedrockSearchResult);
      console.log(`INFO: Patent search results saved to ${searchResultFilename}`);

      // Now copy the file to the results folder
      await copyResultToResultsFolder(searchResultFilename);
      console.log(`INFO: Patent search results copied to ${path.join('results', searchResultFilename)}`);

      await runPatentDownloader(searchResultFilename); // Call the downloader script
  } catch (error) {
      console.error('INFO: Error running patent search:', error);
      readline.close();
  }
}

async function processResult() {
  const submissionsDir = 'submissions';

  try {
      if (!fs.existsSync(submissionsDir)) {
          fs.mkdirSync(submissionsDir);
          console.log(`INFO: Created "${submissionsDir}" directory.`);
      }

      let filename;
      let fullFilePath;
      let fileExists = false;

      while (!fileExists) {
          filename = await new Promise((resolve) => {
              readline.question('Enter the name of the text file (.txt or .xml) in the "submissions" folder: ', resolve);
          });

          fullFilePath = path.join(__dirname, submissionsDir, filename);

          if (fs.existsSync(fullFilePath)) {
              fileExists = true;
              console.log(`INFO: File "${filename}" found in "${submissionsDir}".`);
          } else {
              console.log(`INFO: File "${filename}" not found in "${submissionsDir}". Please try again.`);
          }
      }

      let inputText = fs.readFileSync(fullFilePath, 'utf-8');

      const fileExtension = filename.split('.').pop().toLowerCase();
      console.log(`INFO: File type: ${fileExtension}`);

      if (fileExtension === 'xml') {
          console.log('INFO: Processing XML file as plain text.');
      } else if (fileExtension === 'txt') {
          console.log('INFO: Processing TXT file.');
      }

      const predefinedText = `There are 5 (five) steps listed below. Process the prompt marked "PROMPT" first, then print the final result market "RESULT". The source file is marked under "SOURCE".

      PROMPT

      For all

      1. Extract all rejection categories in the requirements provided using the XML-formatted text attached to this request. Also, extract and correctly group ALL claim numbers under each rejection in the same paragraph (e.g., "Claims 1-4, 9, 23, and 15-18"), and include the corresponding rejection type (e.g. “35 USC 102(a)(1)”). Include the prior art references cited in the rejections (e.g. “US 4,458,876”). These prior art references typically have more than 5 digits, ignoring commas or slashes that are separating the digits.
      Provide me output of all extracted claims in the following format:

      Extracted claims:
      (claim(s))
      Corresponding Rejection Paragraph(s) and related claims:
      (rejection paragraphs - claim(s) - related prior art references to the claim, typically have more than 5 digits, ignoring commas or slashes that are separating the digits.)
      List of related references:
      (references + alias - corresponding rejection paragraph(s))

      2. Using the XML document attached, extract all detailed reference data for any rejection paragraph that falls under categories 102 or 103. For each of these paragraphs, list me their data in this format:

      U.S. Patent Reference:
      - Patent Number: (number)
      - Designation: (alias)
      - Citation Type: (102 or 103 rejection)
      - Claim number(s): (range of applicable claim numbers)
      U.S. Patent Application Reference:
      - Application number: (application number)
      - Designation: (alias)
      - Citation type: (102 or 103 rejection)
      - Claim numbers: (range of applicable claim numbers)

      3. Create and print me a full bullet list of all these requirements.
      In each bullet, in the XML document attached below, if and for every 102 or 103 rejection-type paragraph (typically starts with “Regarding claim #” or “Regarding claims #-#”), reprint the FULL paragraph. In each printed paragraph, create an in-line tag around each citation (include only the referenced location, typically page/col/line/figure #s between each tag) and all mentioned reference name aliases (i.e. Schaeper, LeRouax, etc.). In addition, create tags around citations specifically (i.e. <Citation>Schaeper</Citation>). The final result should look something like "<Paragraph 41>Regarding claims 1-3, 7, 10, and 12-14, <Citation>Schaeper</Citation> is seen as disclosing all...".

      4. Create and print me a full bullet list of all these requirements.
      In each bullet, in the XML document attached below, if in a section with a header “Drawing” or “Specification”, and if a paragraph in this section contains the following key phrase(s):
      “is objected to because”
      “it is suggested”
      “appropriate correction is required”
      “informalities”
      Reprint the entire paragraph.

      RESULT

      After processing and with ENTIRE response after completing the requirements listed above, carefully produce results for each step, and compile them into a full detailed JSON-formatted response.
      For any references (i.e. Schaeper, LeRouax), wrap the ONLY patent number (typically begins with US) with an HTML tag in format <Reference> & </Reference>, then remove all spaces, commas, and slashes in the patent number itself (the result should look something like "(<Reference>US20140183381</Reference>)" and for the final JSON output, wrap all paragraph numbers from only in sections that include citations.

      SOURCE


      `;
      inputText = predefinedText + inputText;

      console.log('INFO: File content retrieved and modified.');

      console.log('INFO: Sending text to AWS Bedrock.');
      const bedrockResult = await processWithBedrock(inputText);
      console.log('INFO: AWS Bedrock processing complete.');

      const resultFilename = filename.split('.').slice(0, -1).join('.') + '_result.txt';
      // Write the result to the current directory first
      fs.writeFileSync(resultFilename, bedrockResult);

      await copyResultToResultsFolder(resultFilename);

      console.log(`INFO: Processing complete. Results saved to ${path.join('results', resultFilename)}`);

      const searchConfirmation = await new Promise((resolve) => {
          readline.question('Do you wish to run a patent search on the results? (y/n): ', resolve);
      });

      if (searchConfirmation.toLowerCase() === 'y') {
          await runPatentSearch(resultFilename);
      } else {
          console.log('INFO: Exiting script.');
          readline.close();
      }

  } catch (error) {
      console.error('INFO: Error processing with AI:', error);
      readline.close();
  }
}

async function saveResultToFile(text, filename) {
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function downloadFile(filename) {
    const a = document.createElement('a');
    a.href = filename;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

if (require.main === module) {
    processResult();
} else {
    // Browser-related code remains the same as it's not the focus of this modification
    document.getElementById('analysisButton').addEventListener('click', async () => {
        const button = document.getElementById('analysisButton');
        button.disabled = true;
        button.textContent = 'Processing...';

        try {
            const filename = await getFilenameFromUser();
            const inputText = await readFileContent(filename);
            const bedrockResult = await processWithBedrock(inputText);
            await saveOrDownloadResult(bedrockResult);
            button.textContent = 'Download Results';
            button.disabled = false;
            button.removeEventListener('click', arguments.callee);
            button.addEventListener('click', () => {
                downloadFile('ai_processed_result.txt');
            });
        } catch (error) {
            console.error('Error processing with AI:', error);
            button.textContent = 'Process with AI';
            button.disabled = false;
            alert('An error occurred during processing. Please check the console.');
        }
    });

    async function getFilenameFromUser() {
        return prompt('Enter the name of the text file (.txt or .xml):');
    }

    async function readFileContent(fileInputId) {
        return new Promise((resolve, reject) => {
            const fileInput = document.getElementById(fileInputId);
            const file = fileInput.files[0];

            if (!file) {
                reject(new Error('No file selected.'));
                return;
            }

            const reader = new FileReader();

            reader.onload = (event) => {
                resolve(event.target.result);
            };

            reader.onerror = (event) => {
                reject(event.target.error);
            };

            reader.readAsText(file);
        });
    }

    async function saveOrDownloadResult(bedrockResult) {
        await saveResultToFile(bedrockResult, 'ai_processed_result.txt');
    }
}