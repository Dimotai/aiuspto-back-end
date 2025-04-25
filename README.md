# AIUSPTO Back-end Scripts

Dev: Tim Dai

https://www.dimotai.com

# Required Dependencies

NodeJS
AWS SDK (npm install aws-sdk)

.env (AWS Secret ID, Key, Region)

# How to Use

Navigate to local working directory with command line

Place input files in "submissions" folder

Run "node processResult.js" and follow input steps

Output files will show up in "results" folder if successful

# TO/DO @ Final Enviroment

Change Haiku model to Sonnett 3.5

User submissions must be integrated to auto-fetch and download into "submissions" folder from working front-end system

User results must be integrated to display on working front-end

HTML tags in working front-end must direct to specific file in a PDF preview format (i.e. <Reference>US15218936</Reference> to US15218936.pdf)

# Script Explanations

processResult.js takes in a .xml or .txt file, sends the file and a predefined prompt (summarize document) connected AWS AI model services, and retrieves & downloads the result (JSON-formatted summarized response) in the "results" folder via local directory.

User will receive an option to process a reference search, which will run another predefined prompt to extract all related reference files, compile them in clean comma-separated format. This file will also be downloaded in the same folder via local directory.

patent_downloader_auto.js automatically runs upon confirmation of the above option to process a reference search, where the reference-contained file will be processed with each reference #, separated by commas, through Google Patent's API. The reference # is directly appended to the end of its search link, allowing direct download of PDFs of references if found. Downloads for all patents that are not found or already exist in the "results" folder will be skipped.

app.js is a temporary front-end UI interface for previewing PDFs side-by-side. This has not been nearly completed.

main.js is a temporary back-end service to automatically retrive PDFs from Google Patents inputted by the user in the front-end interface (app.js), using the same technology as patent_downloader_auto.js, assuming input is a reference number.
