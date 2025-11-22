const fs = require("fs-extra");
const path = require("path");
const { execSync } = require("child_process");

async function packageElectron() {
  try {
    console.log("Step 1: Building Python server...");
    const serverDir = path.join(__dirname, "..", "server");
    const serverBuildScript = path.join(serverDir, "build.bat");

    if (fs.existsSync(serverBuildScript)) {
      try {
        execSync(`"${serverBuildScript}"`, {
          stdio: "inherit",
          cwd: serverDir,
        });
        console.log("✓ Python server built successfully");
      } catch (err) {
        console.warn("⚠ Python server build failed, continuing without it...");
      }
    } else {
      console.warn("⚠ Python server build script not found, skipping...");
    }

    console.log("\nStep 2: Building Next.js...");
    execSync("next build", { stdio: "inherit" });

    console.log("\nStep 3: Running post-build...");
    execSync("node scripts/post-build.js", { stdio: "inherit" });

    console.log("\nStep 4: Packaging with electron-packager...");
    execSync(
      'electron-packager . CoffeeCube --platform=win32 --arch=x64 --out=dist --overwrite --ignore="^/(dist|.git|.next(?!/standalone)|server/build)" --prune=false',
      { stdio: "inherit" }
    );

    console.log("\nStep 5: Copying .next/standalone to packaged app...");
    const rootDir = path.join(__dirname, "..");
    const standaloneSource = path.join(rootDir, ".next", "standalone");
    const packagedAppPath = path.join(
      rootDir,
      "dist",
      "CoffeeCube-win32-x64",
      "resources",
      "app"
    );
    const standaloneTarget = path.join(packagedAppPath, ".next", "standalone");

    if (!fs.existsSync(standaloneSource)) {
      throw new Error(
        ".next/standalone folder not found. Make sure Next.js build completed successfully."
      );
    }

    // .next/standalone 폴더 복사
    await fs.copy(standaloneSource, standaloneTarget, { overwrite: true });
    console.log("✓ Copied .next/standalone to packaged app");

    // .next/static 폴더도 복사 (standalone 내부에 있어야 함)
    const staticSource = path.join(rootDir, ".next", "static");
    const staticTarget = path.join(standaloneTarget, ".next", "static");
    if (fs.existsSync(staticSource)) {
      await fs.copy(staticSource, staticTarget, { overwrite: true });
      console.log("✓ Copied .next/static to standalone");
    }

    // public 폴더 복사 (standalone 내부에 있어야 함)
    const publicSource = path.join(rootDir, "public");
    const publicTarget = path.join(standaloneTarget, "public");
    if (fs.existsSync(publicSource)) {
      await fs.copy(publicSource, publicTarget, { overwrite: true });
      console.log("✓ Copied public to standalone");
    }

    // .env.local 파일 복사 (있는 경우)
    const envSource = path.join(rootDir, ".env.local");
    const envTarget = path.join(packagedAppPath, ".env.local");
    if (fs.existsSync(envSource)) {
      await fs.copy(envSource, envTarget, { overwrite: true });
      console.log("✓ Copied .env.local to packaged app");
    } else {
      console.log(
        "⚠ .env.local not found - app may not work without environment variables"
      );
    }

    // Python 서버 실행 파일 복사
    const pythonServerSource = path.join(
      serverDir,
      "dist",
      "serial-server.exe"
    );
    const pythonServerTarget = path.join(packagedAppPath, "server", "dist");
    if (fs.existsSync(pythonServerSource)) {
      await fs.ensureDir(pythonServerTarget);
      await fs.copy(
        pythonServerSource,
        path.join(pythonServerTarget, "serial-server.exe"),
        { overwrite: true }
      );
      console.log("✓ Copied Python server to packaged app");
    } else {
      console.log(
        "⚠ Python server executable not found - serial port features will not be available"
      );
    }

    // node_modules 복사 (standalone에 필요한 경우)
    const nodeModulesSource = path.join(standaloneSource, "node_modules");
    const nodeModulesTarget = path.join(standaloneTarget, "node_modules");
    if (fs.existsSync(nodeModulesSource)) {
      await fs.copy(nodeModulesSource, nodeModulesTarget, { overwrite: true });
      console.log("✓ Copied node_modules to standalone");
    }

    console.log("\n✅ Packaging completed successfully!");
    console.log(
      `📦 Packaged app location: ${path.join(
        rootDir,
        "dist",
        "CoffeeCube-win32-x64"
      )}`
    );
  } catch (error) {
    console.error("❌ Packaging failed:", error);
    process.exit(1);
  }
}

packageElectron();
