import { Router } from "express";
import {
  authenticateAdmin,
  createSessionForAdmin,
  deleteAdminSession,
  getAdminFromSessionToken,
  removeAdminProfileImage,
  updateAdminProfile,
  updateAdminProfileImage,
} from "../services/adminService.js";

const router = Router();

const getAdminSessionCookieName = () =>
  process.env.ADMIN_SESSION_COOKIE_NAME || "efficient_global_admin_session";

const getStringValue = (value) =>
  typeof value === "string" ? value.trim() : "";

const getBooleanValue = (value) => value === true || value === "true";

const getLoginIdentifier = (body) =>
  getStringValue(body.identifier || body.email || body.username);

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

const getAuthenticatedAdmin = (req) =>
  getAdminFromSessionToken(getAdminSessionToken(req));

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
  const identifier = getLoginIdentifier(body);
  const password = getStringValue(body.password);
  const errors = {};

  if (!identifier) {
    errors.identifier = "Enter your username or email.";
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
      identifier: getLoginIdentifier(req.body),
      password: getStringValue(req.body.password),
    });

    if (!admin) {
      return res.status(401).json({
        message: "Invalid username/email or password.",
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
    const admin = await getAuthenticatedAdmin(req);

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

router.patch("/profile", async (req, res) => {
  try {
    const admin = await getAuthenticatedAdmin(req);

    if (!admin) {
      return res.status(401).json({
        message: "Not authenticated.",
      });
    }

    const updatedAdmin = await updateAdminProfile({
      adminId: admin.id,
      name: getStringValue(req.body?.name || req.body?.displayName),
    });

    if (!updatedAdmin) {
      return res.status(404).json({
        message: "Admin account not found.",
      });
    }

    return res.json({
      message: "Profile updated.",
      admin: updatedAdmin,
    });
  } catch (error) {
    if (error.code === "INVALID_ADMIN_PROFILE") {
      return res.status(400).json({
        message: error.message,
        errors: {
          name: error.message,
        },
      });
    }

    console.error("Admin profile update failed", {
      message: error.message,
    });

    return res.status(500).json({
      message: "We could not update your profile right now.",
    });
  }
});

router.patch("/profile-image", async (req, res) => {
  try {
    const admin = await getAuthenticatedAdmin(req);

    if (!admin) {
      return res.status(401).json({
        message: "Not authenticated.",
      });
    }

    const updatedAdmin = await updateAdminProfileImage({
      adminId: admin.id,
      profileImage: getStringValue(req.body?.profileImage),
    });

    if (!updatedAdmin) {
      return res.status(404).json({
        message: "Admin account not found.",
      });
    }

    return res.json({
      message: "Profile image updated.",
      admin: updatedAdmin,
    });
  } catch (error) {
    if (error.code === "INVALID_PROFILE_IMAGE") {
      return res.status(400).json({
        message: error.message,
        errors: {
          profileImage: error.message,
        },
      });
    }

    console.error("Admin profile image update failed", {
      message: error.message,
    });

    return res.status(500).json({
      message: "We could not update your profile image right now.",
    });
  }
});

router.delete("/profile-image", async (req, res) => {
  try {
    const admin = await getAuthenticatedAdmin(req);

    if (!admin) {
      return res.status(401).json({
        message: "Not authenticated.",
      });
    }

    const updatedAdmin = await removeAdminProfileImage(admin.id);

    if (!updatedAdmin) {
      return res.status(404).json({
        message: "Admin account not found.",
      });
    }

    return res.json({
      message: "Profile image removed.",
      admin: updatedAdmin,
    });
  } catch (error) {
    console.error("Admin profile image removal failed", {
      message: error.message,
    });

    return res.status(500).json({
      message: "We could not remove your profile image right now.",
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
