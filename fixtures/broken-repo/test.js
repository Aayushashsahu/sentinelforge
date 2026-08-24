const packageVersion = "1.0.1";
const manifestVersion = "1.0.0";
if (packageVersion !== manifestVersion) throw new Error("release-check failed: package and manifest versions diverged");
