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
