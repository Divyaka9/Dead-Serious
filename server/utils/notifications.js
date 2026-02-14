function notifyNominee({ vaultId, vaultName, nomineeEmail, ownerId }) {
  // Stub for email provider integration.
  console.log(
    `[notify] nominee=${nomineeEmail} vault=${vaultId} vaultName=${vaultName} ownerId=${ownerId}`
  );
}

module.exports = {
  notifyNominee,
};
