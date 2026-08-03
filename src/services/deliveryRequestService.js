import {
  createDeliveryRequest,
  deliveryRequestEmailStatuses,
  ensureDeliveryRequestIndexes,
  listDeliveryRequests,
  updateDeliveryRequestEmailNotification,
} from "../repositories/deliveryRequestRepository.js";

const maxStoredEmailErrorMessageLength = 500;
const defaultDeliveryRequestListLimit = 50;
const maxDeliveryRequestListLimit = 100;

const getStoredEmailErrorMessage = (error) => {
  const message =
    error instanceof Error ? error.message : "Unknown email notification error";

  return message.slice(0, maxStoredEmailErrorMessageLength);
};

export const initializeDeliveryRequestCollection = () =>
  ensureDeliveryRequestIndexes();

export const recordDeliveryRequest = (submission) =>
  createDeliveryRequest(submission);

const getDeliveryRequestListLimit = (limit) => {
  const parsedLimit = Number(limit);

  if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
    return defaultDeliveryRequestListLimit;
  }

  return Math.min(Math.floor(parsedLimit), maxDeliveryRequestListLimit);
};

const toIsoString = (value) => {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

const toSafeDeliveryRequest = (deliveryRequest) => ({
  id: deliveryRequest._id.toString(),
  source: deliveryRequest.source,
  pickup: deliveryRequest.pickup,
  delivery: deliveryRequest.delivery,
  datetime: deliveryRequest.datetime,
  vehicle: deliveryRequest.vehicle,
  name: deliveryRequest.name,
  email: deliveryRequest.email,
  phone: deliveryRequest.phone,
  rush: deliveryRequest.rush,
  instructions: deliveryRequest.instructions,
  status: deliveryRequest.status,
  emailNotification: {
    status: deliveryRequest.emailNotification?.status || "",
    resendEmailId: deliveryRequest.emailNotification?.resendEmailId || "",
    errorMessage: deliveryRequest.emailNotification?.errorMessage || "",
    updatedAt: toIsoString(deliveryRequest.emailNotification?.updatedAt),
  },
  submittedAt: toIsoString(deliveryRequest.submittedAt),
  createdAt: toIsoString(deliveryRequest.createdAt),
  updatedAt: toIsoString(deliveryRequest.updatedAt),
});

export const getDeliveryRequestsForAdmin = async ({ limit } = {}) => {
  const deliveryRequests = await listDeliveryRequests({
    limit: getDeliveryRequestListLimit(limit),
  });

  return deliveryRequests.map(toSafeDeliveryRequest);
};

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
