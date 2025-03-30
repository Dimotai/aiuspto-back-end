/*

Dependencies:
AWS SDK (npm install)
.env (AWS Secret ID + Key)

Results are stored in local directory and in /results
Prompts are stored in /prompts


TO/DO

processResult.js currently scans directory for input file (.txt or .xml). Need to verify online sources of xml files to allow
integration of curl/pull xml file from PDF patent file name. This allows seamless PDF front-end GUI display capability in
congruency to back-end text-format-supported processing.


NOTES

Claude provides slightly altered (formatting and quality of information) responses every request. Percentage-wise, I'd rate the
accuracy between responses anywhere from 70-90%. Consider consistently testing with higher-quality AI models.


*/

require('dotenv').config();

const fs = require('fs');
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function processResult() {
  try {
    let filename;
    let fileExists = false;

    while (!fileExists) {
      filename = await new Promise((resolve) => {
        readline.question('Enter the name of the text file (.txt or .xml): ', resolve);
      });

      if (fs.existsSync(filename)) {
        fileExists = true;
        console.log(`INFO: File "${filename}" found.`);
      } else {
        console.log(`INFO: File "${filename}" not found. Please try again.`);
      }
    }

    let inputText = fs.readFileSync(filename, 'utf-8');

    const fileExtension = filename.split('.').pop().toLowerCase();
    console.log(`INFO: File type: ${fileExtension}`);

    if (fileExtension === 'xml') {
      console.log('INFO: Processing XML file as plain text.');
    } else if (fileExtension === 'txt') {
      console.log('INFO: Processing TXT file.');
    }

    const predefinedText = `There are 5 (five) steps listed below. Carefully produce results for each step, and compile them into a full detailed response.

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
    In each bullet, in the XML document attached below, if and for every 102 or 103 rejection-type paragraph (typically starts with “Regarding claim #” or “Regarding claims #-#”), reprint the FULL paragraph. In each printed paragraph, create an in-line tag around each citation (include only the referenced location, typically page/col/line/figure #s between each tag) and all mentioned reference name aliases (i.e. Schaeper, LeRouax, etc.)
    
    4. Create and print me a full bullet list of all these requirements.
    In each bullet, in the XML document attached below, if in a section with a header “Drawing” or “Specification”, and if a paragraph in this section contains the following key phrase(s):
    “is objected to because”
    “it is suggested”
    “appropriate correction is required”
    “informalities”
    Reprint the entire paragraph.
    
    The source file is provided below.

    `;
    inputText = predefinedText + inputText;

    console.log('INFO: File content retrieved and modified.');

    console.log('INFO: Sending text to AWS Bedrock.');
    const bedrockResult = await processWithBedrock(inputText);
    console.log('INFO: AWS Bedrock processing complete.');

    const resultFilename = filename.split('.').slice(0, -1).join('.') + '_result.txt';
    console.log(`INFO: Saving results to ${resultFilename}.`);
    fs.writeFileSync(resultFilename, bedrockResult);

    await copyResultToResultsFolder(resultFilename);

    console.log(`INFO: Processing complete. Results saved to ${resultFilename}`);

    readline.close();

  } catch (error) {
    console.error('INFO: Error processing with AI:', error);
    readline.close();
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
    const destPath = `${resultsDir}/${filename}`;

    fs.copyFileSync(sourcePath, destPath);
    console.log(`INFO: Copied "${filename}" to "${resultsDir}" folder.`);

  } catch (error) {
    console.error(`ERROR: Could not copy "${filename}" to "${resultsDir}":`, error);
  }
}

if (require.main === module) {
  processResult();
} else {
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

async function processWithBedrock(inputText) {
  try {
    const AWS = require('aws-sdk');
    AWS.config.update({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    });

    const bedrockRuntime = new AWS.BedrockRuntime();

    const formattedPrompt = `\n\nHuman:${inputText}\n\nAssistant:`;

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