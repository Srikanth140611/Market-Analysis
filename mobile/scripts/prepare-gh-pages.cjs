const fs = require("node:fs");
const path = require("node:path");

const distDir = path.join(__dirname, "..", "dist-gh-pages");
const indexPath = path.join(distDir, "index.html");
const noJekyllPath = path.join(distDir, ".nojekyll");

if (!fs.existsSync(indexPath)) {
  throw new Error(`Missing exported index: ${indexPath}`);
}

const html = fs.readFileSync(indexPath, "utf8");
const bundleMatch = html.match(/src="\/_expo\/static\/js\/web\/(index-[^"]+\.js)"/);

if (!bundleMatch) {
  throw new Error("Unable to determine exported web bundle hash from index.html");
}

const bundleName = bundleMatch[1];
const redirectScript = `<script>(function(){try{var url=new URL(window.location.href);if(!url.searchParams.get('v')){url.searchParams.set('v','${bundleName.replace(/^index-/, "").replace(/\.js$/, "")}');window.location.replace(url.toString());}}catch(e){}})();</script>`;
const normalized = html
  .replace(/src="\/_expo\//g, 'src="./_expo/')
  .replace("<head>", `<head>${redirectScript}`);

fs.writeFileSync(indexPath, normalized, "utf8");
fs.writeFileSync(noJekyllPath, "", "utf8");

console.log("Prepared dist-gh-pages for GitHub Pages.");
