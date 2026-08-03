import { ObjectId } from "mongodb";
import { getDatabase } from "../config/database.js";

const requestInformationCollectionName = "information_requests";

export const requestInformationEmailStatuses = Object.freeze({
  FAILED: "failed",
  PENDING: "pending",
  SENT: "sent",
});

export const requestInformationStatuses = Object.freeze({
  NEW: "new",
});

export const getRequestInformationCollection = () =>
  getDatabase().collection(requestInformationCollectionName);

const toObjectId = (id) =>
  id instanceof ObjectId ? id : ObjectId.isValid(id) && new ObjectId(id);

const getSubmissionDate = (submittedAt) => {
  const submittedAtDate =
    submittedAt instanceof Date ? submittedAt : new Date(submittedAt);

  return Number.isNaN(submittedAtDate.getTime()) ? new Date() : submittedAtDate;
};

export const ensureRequestInformationIndexes = async () => {
  const requestInformation = getRequestInformationCollection();

  await requestInformation.createIndex(
    { submittedAt: -1 },
    {
      name: "information_request_submitted_at",
    },
  );
  await requestInformation.createIndex(
    { status: 1, submittedAt: -1 },
    {
      name: "information_request_status_submitted_at",
    },
  );
  await requestInformation.createIndex(
    { email: 1, submittedAt: -1 },
    {
      name: "information_request_email_submitted_at",
    },
  );
};

export const createRequestInformation = async (submission) => {
  const now = new Date();
  const requestInformation = {
    source: submission.source,
    name: submission.name,
    email: submission.email,
    phone: submission.phone,
    organization: submission.organization,
    message: submission.message,
    status: requestInformationStatuses.NEW,
    emailNotification: {
      status: requestInformationEmailStatuses.PENDING,
      updatedAt: now,
    },
    submittedAt: getSubmissionDate(submission.submittedAt),
    createdAt: now,
    updatedAt: now,
  };

  const result = await getRequestInformationCollection().insertOne(
    requestInformation,
  );

  return {
    ...requestInformation,
    _id: result.insertedId,
  };
};

export const updateRequestInformationEmailNotification = (
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

  return getRequestInformationCollection().updateOne(
    { _id: objectId },
    update,
  );
};
