/* --------------------------------------------------------------- */
/*                              auth.js                            */
/* --------------------------------------------------------------- */
const { Authflow, Titles } = require("prismarine-auth");
const fs = require("fs");
const path = require("path");

const AUTH_CACHE_DIR = path.join(__dirname, "..", ".auth_cache");

class MicrosoftAuth {
  constructor() {
    this.authflow = null;
    this.authenticated = false;
    this.username = null;
    this.uuid = null;
    this.accessToken = null;
  }

  ensureCacheDir() {
    if (!fs.existsSync(AUTH_CACHE_DIR)) {
      fs.mkdirSync(AUTH_CACHE_DIR, { recursive: true });
    }
  }

  async authenticate() {
    this.ensureCacheDir();

    if (!this.authflow) {
      const userIdentifier = "lce-proxy-user";
      this.authflow = new Authflow(userIdentifier, AUTH_CACHE_DIR);
    }

    if (!this.authflow.onMsaCode) {
      this.authflow.onMsaCode = (data) => {
        console.log("\nYou have not yet logged into your Java account!");
        const url = `https://microsoft.com/link?otc=${data.userCode}`;
        console.log(`enter the code ${data.userCode} at ${url}`);
        console.log(
          "If you enabled this by accident and would like to only join offline servers, set USE_JAVA_ACCOUNT to false in constants.js\n",
        );

        try {
          const { exec } = require("child_process");
          const platform = process.platform;
          const command =
            platform === "win32"
              ? `start ${url}`
              : platform === "darwin"
                ? `open ${url}`
                : `xdg-open ${url}`;
          exec(command);
        } catch (err) {
          /* do nothing */
        }
      };
    }

    try {
      const result = await this.authflow.getMinecraftJavaToken({
        fetchProfile: true,
      });

      if (!result.profile) {
        throw new Error(
          "Error logging into Java Edition account! Do you own Minecraft Java Edition?\n",
        );
      }

      this.username = result.profile.name;
      this.uuid = result.profile.id;
      this.accessToken = result.token;
      this.authenticated = true;

      return {
        username: this.username,
        uuid: this.uuid,
        accessToken: this.accessToken,
      };
    } catch (err) {
      throw err;
    }
  }

  async getAuthData() {
    return await this.authenticate();
  }

  isAuthenticated() {
    return this.authenticated;
  }
}

const authInstance = new MicrosoftAuth();

module.exports = authInstance;
/* --------------------------------------------------------------- */
