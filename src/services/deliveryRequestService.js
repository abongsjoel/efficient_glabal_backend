import {
  createDeliveryRequest,
  deliveryRequestEmailStatuses,
  ensureDeliveryRequestIndexes,
  updateDeliveryRequestEmailNotification,
} from "../repositories/deliveryRequestRepository.js";

const maxStoredEmailErrorMessageLength = 500;

const getStoredEmailErrorMessage = (error) => {
  const message =
    error instanceof Error ? error.message : "Unknown email notification error";

  return message.slice(0, maxStoredEmailErrorMessageLength);
};

export const initializeDeliveryRequestCollection = () =>
  ensureDeliveryRequestIndexes();

export const recordDeliveryRequest = (submission) =>
  createDeliveryRequest(submission);

export const markDeliveryRequestEmailSent = (id, resendEmailId) =>
  updateDeliveryRequestEmailNotification(id, {
    resendEmailId,
    status: deliveryRequestEmailStatuses.SENT,
  });

export const markDeliveryRequestEmailFailed = (id, error) =>
  updateDeliveryRequestEmailNotification(id, {
    errorMessage: getStoredEmailErrorMessage(error),
    status: deliveryRequestEmailStatuses.FAILED,
  });
