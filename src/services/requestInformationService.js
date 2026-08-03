import {
  createRequestInformation,
  ensureRequestInformationIndexes,
  requestInformationEmailStatuses,
  updateRequestInformationEmailNotification,
} from "../repositories/requestInformationRepository.js";

const maxStoredEmailErrorMessageLength = 500;

const getStoredEmailErrorMessage = (error) => {
  const message =
    error instanceof Error ? error.message : "Unknown email notification error";

  return message.slice(0, maxStoredEmailErrorMessageLength);
};

export const initializeRequestInformationCollection = () =>
  ensureRequestInformationIndexes();

export const recordRequestInformation = (submission) =>
  createRequestInformation(submission);

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
