function ApprovalStatus({ approved = 0, required = 2, pending = [], nominees = [] }) {
  return (
    <article className="panel">
      <h3>Approval Status</h3>
      <p>
        {approved} / {required} approvals collected
      </p>
      <p>Pending: {pending.length ? pending.join(', ') : 'None'}</p>
      {!!nominees.length && (
        <ul className="nominee-list">
          {nominees.map((nominee) => (
            <li key={nominee.id || nominee.email}>
              <span>{nominee.email}</span>
              <span className={nominee.status === 'approved' ? 'pill approved' : 'pill'}>
                {nominee.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

export default ApprovalStatus
