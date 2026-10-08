# Validation — OmniStaq v4

Completed:
- JavaScript syntax checks for all bundled JavaScript files.
- 10 Node VM regression checks covering missing backend configuration, invalid backend URL, mixed HTTP/HTTPS, admin redirect, same-host setup, media URL resolution, successful API response, MySQL-error propagation, non-JSON/network responses, and setup failure keeping account creation disabled.
- Source review of MySQL media storage, public/private media separation, order-token authentication, admin authentication, CSRF checks, receipt transactions and schema upgrade.
- Archive integrity and local HTML asset-reference checks.

Not completed:
- PHP execution/lint and real MySQL integration tests: PHP/MySQL runtimes are unavailable in the editing environment.
- Live deployment and browser CORS/session verification: no live hosting URL or access was supplied.

Before production use, configure the two hosts using START-HERE.md, run connection.html from both, then verify:
1. Create/sign in to admin on the PHP host.
2. Upload a product image, save, reload and view it on GitHub Pages.
3. Place a bank-transfer test order from GitHub Pages, upload a receipt and view it in admin.
4. Replace that receipt; confirm only the new receipt is linked. Invalid images must not replace the old receipt.
5. Confirm media.php does not serve a proof ID, and an unauthenticated request cannot retrieve admin receipt URLs.
6. Back up MySQL including the media table.
