# DoziLab University Web App UI

Note: after every Pull be sure you got the right dependencies:
`rm -rf node_modules package-lock.json`
`npm install`

This is a code bundle for DoziLab University Web App UI. The original project is available at https://www.figma.com/design/DyN0adA4Ye8swEhD81VLXh/DoziLab-University-Web-App-UI.

## Running the code

Run `npm i` to install the dependencies.

Run `npm i --save-dev @types/react`

Run `npm run dev` to start the development server.

## Running Docker

Note: Main-Folder can be named 'appstore-frontend' or differently.

– Make sure a `.env` with `VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_REALM`, `VITE_KEYCLOAK_CLIENT_ID` exists in the project root (it is included in the image; do not add it back to `.dockerignore`).

– Start Docker local.

– Build Container: `docker build -t appstore-frontend .`

– Start Container in main folder: `docker run -p 3000:80 appstore-frontend`

– Open: 'http://localhost:3000'

– Close: ctrl + c
