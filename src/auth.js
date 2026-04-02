/* --------------------------------------------------------------- */
/*                              auth.js                            */
/* --------------------------------------------------------------- */
const { Authflow, Titles } = require("prismarine-auth");
const fs = require("fs");
const path = require("path");

const AUTH_CACHE_DIR = path.join(__dirname, "..", ".auth_cache");
const USER_IDENTIFIER = "lce-proxy-user";

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

  async authenticate(onDeviceCode) {
    this.ensureCacheDir();

    this.authflow = new Authflow(USER_IDENTIFIER, AUTH_CACHE_DIR);

    if (onDeviceCode) {
      this.authflow.codeCallback = onDeviceCode;
    }

    const result = await this.authflow.getMinecraftJavaToken({
      fetchProfile: true,
    });

    if (!result.profile) {
      throw new Error(
        "Couldn't log into Java Edition account! Do you own Minecraft Java Edition?",
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
  }

  unlink() {
    try {
      const files = fs.readdirSync(AUTH_CACHE_DIR);
      for (const file of files) {
        fs.unlinkSync(path.join(AUTH_CACHE_DIR, file));
      }
    } catch (e) {
      /* do nothing */
    }
    this.authflow = null;
    this.authenticated = false;
    this.username = null;
    this.uuid = null;
    this.accessToken = null;
  }

  isAuthenticated() {
    return this.authenticated;
  }

  hasCachedAccount() {
    try {
      const files = fs.readdirSync(AUTH_CACHE_DIR);
      return files.length > 0;
    } catch (e) {
      return false;
    }
  }
}

const authInstance = new MicrosoftAuth();

module.exports = authInstance;
/* --------------------------------------------------------------- */
