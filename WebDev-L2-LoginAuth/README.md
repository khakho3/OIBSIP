# Aziz Tech Org Authentication Portal

A front-end authentication exercise using HTML, CSS, and JavaScript.

## Run it

Open `index.html` in a modern browser (or serve this folder with any static HTTP server). Register an account, sign in, and visit the protected dashboard.

## Notes

- Account records are in `localStorage` under `authPortalUsers`; they contain usernames, emails, and SHA-256 password hashes—not plaintext passwords.
- The active login is stored in `sessionStorage` under `authPortalSession`. Direct visits to the dashboard without it redirect to the sign-in page.
- This is a learning demo only. Real applications must authenticate on a server and use secure, `HttpOnly` session cookies; browser storage can be read by injected JavaScript.
