function ApprovalStatus({ approved = 0, required = 3, pending = [] }) {
  return (
    <article>
      <h3>Approval Status</h3>
      <p>
        {approved} / {required} approvals collected
      </p>
      <p>Pending: {pending.length ? pending.join(', ') : 'None'}</p>
    </article>
  )
}

export default ApprovalStatus
