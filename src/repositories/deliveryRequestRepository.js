import { ObjectId } from "mongodb";
import { getDatabase } from "../config/database.js";

const deliveryRequestsCollectionName = "delivery_requests";

export const deliveryRequestEmailStatuses = Object.freeze({
  FAILED: "failed",
  PENDING: "pending",
  SENT: "sent",
});

export const deliveryRequestStatuses = Object.freeze({
  NEW: "new",
});

export const getDeliveryRequestsCollection = () =>
  getDatabase().collection(deliveryRequestsCollectionName);

const toObjectId = (id) =>
  id instanceof ObjectId ? id : ObjectId.isValid(id) && new ObjectId(id);

const getSubmissionDate = (submittedAt) => {
  const submittedAtDate =
    submittedAt instanceof Date ? submittedAt : new Date(submittedAt);

  return Number.isNaN(submittedAtDate.getTime()) ? new Date() : submittedAtDate;
};

export const ensureDeliveryRequestIndexes = async () => {
  const deliveryRequests = getDeliveryRequestsCollection();

  await deliveryRequests.createIndex(
    { submittedAt: -1 },
    {
      name: "delivery_request_submitted_at",
    },
  );
  await deliveryRequests.createIndex(
    { status: 1, submittedAt: -1 },
    {
      name: "delivery_request_status_submitted_at",
    },
  );
  await deliveryRequests.createIndex(
    { email: 1, submittedAt: -1 },
    {
      name: "delivery_request_email_submitted_at",
    },
  );
};

export const createDeliveryRequest = async (submission) => {
  const now = new Date();
  const deliveryRequest = {
    source: submission.source,
    pickup: submission.pickup,
    delivery: submission.delivery,
    datetime: submission.datetime,
    vehicle: submission.vehicle,
    name: submission.name,
    email: submission.email,
    phone: submission.phone,
    rush: submission.rush,
    instructions: submission.instructions,
    status: deliveryRequestStatuses.NEW,
    emailNotification: {
      status: deliveryRequestEmailStatuses.PENDING,
      updatedAt: now,
    },
    submittedAt: getSubmissionDate(submission.submittedAt),
    createdAt: now,
    updatedAt: now,
  };

  const result = await getDeliveryRequestsCollection().insertOne(
    deliveryRequest,
  );

  return {
    ...deliveryRequest,
    _id: result.insertedId,
  };
};

export const updateDeliveryRequestEmailNotification = (
  id,
  { errorMessage, resendEmailId, status },
) => {
  const objectId = toObjectId(id);

  if (!objectId) {
    return null;
  }

  const now = new Date();
  const update = {
    $set: {
      "emailNotification.status": status,
      "emailNotification.updatedAt": now,
      updatedAt: now,
    },
  };

  if (resendEmailId) {
    update.$set["emailNotification.resendEmailId"] = resendEmailId;
  }

  if (errorMessage) {
    update.$set["emailNotification.errorMessage"] = errorMessage;
  }

  return getDeliveryRequestsCollection().updateOne({ _id: objectId }, update);
};

export const listDeliveryRequests = ({ limit }) =>
  getDeliveryRequestsCollection()
    .find({})
    .sort({ submittedAt: -1 })
    .limit(limit)
    .toArray();
