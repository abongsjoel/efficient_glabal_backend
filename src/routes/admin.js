import { Router } from "express";
import {
  authenticateAdmin,
  createSessionForAdmin,
  deleteAdminSession,
  getAdminFromSessionToken,
} from "../services/adminService.js";

const router = Router();

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const getAdminSessionCookieName = () =>
  process.env.ADMIN_SESSION_COOKIE_NAME || "efficient_global_admin_session";

const getStringValue = (value) =>
  typeof value === "string" ? value.trim() : "";

const getBooleanValue = (value) => value === true || value === "true";

const parseCookies = (cookieHeader = "") =>
  cookieHeader.split(";").reduce((cookies, cookie) => {
    const [name, ...valueParts] = cookie.trim().split("=");

    if (!name) {
      return cookies;
    }

    try {
      return {
        ...cookies,
        [name]: decodeURIComponent(valueParts.join("=")),
      };
    } catch {
      return cookies;
    }
  }, {});

const getAdminSessionToken = (req) =>
  parseCookies(req.headers.cookie)[getAdminSessionCookieName()];

const getBooleanEnvironmentValue = (key, fallback) => {
  const value = process.env[key];

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
};

const getAdminSessionCookieOptions = (maxAge) => {
  const isProduction = process.env.NODE_ENV === "production";
  const secure = getBooleanEnvironmentValue(
    "ADMIN_COOKIE_SECURE",
    isProduction,
  );
  const sameSite = process.env.ADMIN_COOKIE_SAME_SITE || "lax";

  return {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite,
    secure,
  };
};

const getClearAdminSessionCookieOptions = () => {
  const { maxAge: _maxAge, ...options } = getAdminSessionCookieOptions(0);

  return options;
};

const validateAdminLogin = (body) => {
  const email = getStringValue(body.email);
  const password = getStringValue(body.password);
  const errors = {};

  if (!email) {
    errors.email = "Enter an email address.";
  } else if (!emailPattern.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!password) {
    errors.password = "Enter your password.";
  }

  return errors;
};

router.post("/login", async (req, res) => {
  const errors = validateAdminLogin(req.body);

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      message: "Please correct the highlighted fields.",
      errors,
    });
  }

  try {
    const admin = await authenticateAdmin({
      email: getStringValue(req.body.email),
      password: getStringValue(req.body.password),
    });

    if (!admin) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const session = await createSessionForAdmin(admin.id, {
      keepMeLoggedIn: getBooleanValue(req.body.keepMeLoggedIn),
    });

    res.cookie(
      getAdminSessionCookieName(),
      session.token,
      getAdminSessionCookieOptions(session.maxAgeMs),
    );

    return res.json({
      message: "Login successful.",
      admin,
    });
  } catch (error) {
    console.error("Admin login failed", {
      message: error.message,
    });

    return res.status(500).json({
      message: "We could not sign you in right now. Please try again later.",
    });
  }
});

router.get("/me", async (req, res) => {
  try {
    const admin = await getAdminFromSessionToken(getAdminSessionToken(req));

    if (!admin) {
      return res.status(401).json({
        message: "Not authenticated.",
      });
    }

    return res.json({ admin });
  } catch (error) {
    console.error("Admin session lookup failed", {
      message: error.message,
    });

    return res.status(500).json({
      message: "We could not verify your session right now.",
    });
  }
});

router.post("/logout", async (req, res) => {
  try {
    await deleteAdminSession(getAdminSessionToken(req));
    res.clearCookie(
      getAdminSessionCookieName(),
      getClearAdminSessionCookieOptions(),
    );

    return res.json({
      message: "Logged out.",
    });
  } catch (error) {
    console.error("Admin logout failed", {
      message: error.message,
    });

    return res.status(500).json({
      message: "We could not log you out right now.",
    });
  }
});

export default router;
