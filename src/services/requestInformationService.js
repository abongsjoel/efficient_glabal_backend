import {
  createRequestInformation,
  ensureRequestInformationIndexes,
  listRequestInformation,
  requestInformationEmailStatuses,
  updateRequestInformationEmailNotification,
} from "../repositories/requestInformationRepository.js";

const maxStoredEmailErrorMessageLength = 500;
const defaultRequestInformationListLimit = 50;
const maxRequestInformationListLimit = 100;

const getStoredEmailErrorMessage = (error) => {
  const message =
    error instanceof Error ? error.message : "Unknown email notification error";

  return message.slice(0, maxStoredEmailErrorMessageLength);
};

export const initializeRequestInformationCollection = () =>
  ensureRequestInformationIndexes();

export const recordRequestInformation = (submission) =>
  createRequestInformation(submission);

const getRequestInformationListLimit = (limit) => {
  const parsedLimit = Number(limit);

  if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
    return defaultRequestInformationListLimit;
  }

  return Math.min(Math.floor(parsedLimit), maxRequestInformationListLimit);
};

const toIsoString = (value) => {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

const toSafeRequestInformation = (requestInformation) => ({
  id: requestInformation._id.toString(),
  source: requestInformation.source,
  name: requestInformation.name,
  email: requestInformation.email,
  phone: requestInformation.phone,
  organization: requestInformation.organization,
  message: requestInformation.message,
  status: requestInformation.status,
  emailNotification: {
    status: requestInformation.emailNotification?.status || "",
    resendEmailId: requestInformation.emailNotification?.resendEmailId || "",
    errorMessage: requestInformation.emailNotification?.errorMessage || "",
    updatedAt: toIsoString(requestInformation.emailNotification?.updatedAt),
  },
  submittedAt: toIsoString(requestInformation.submittedAt),
  createdAt: toIsoString(requestInformation.createdAt),
  updatedAt: toIsoString(requestInformation.updatedAt),
});

export const getRequestInformationForAdmin = async ({ limit } = {}) => {
  const requestInformation = await listRequestInformation({
    limit: getRequestInformationListLimit(limit),
  });

  return requestInformation.map(toSafeRequestInformation);
};

export const markRequestInformationEmailSent = (id, resendEmailId) =>
  updateRequestInformationEmailNotification(id, {
    resendEmailId,
    status: requestInformationEmailStatuses.SENT,
  });

export const markRequestInformationEmailFailed = (id, error) =>
  updateRequestInformationEmailNotification(id, {
    errorMessage: getStoredEmailErrorMessage(error),
    status: requestInformationEmailStatuses.FAILED,
  });
