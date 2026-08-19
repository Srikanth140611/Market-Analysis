const fs = require("node:fs");
const path = require("node:path");

const distDir = path.join(__dirname, "..", "dist-gh-pages");
const indexPath = path.join(distDir, "index.html");
const noJekyllPath = path.join(distDir, ".nojekyll");

if (!fs.existsSync(indexPath)) {
  throw new Error(`Missing exported index: ${indexPath}`);
}

const html = fs.readFileSync(indexPath, "utf8");
const normalized = html.replace(/src="\/_expo\//g, 'src="./_expo/');

fs.writeFileSync(indexPath, normalized, "utf8");
fs.writeFileSync(noJekyllPath, "", "utf8");

console.log("Prepared dist-gh-pages for GitHub Pages.");
