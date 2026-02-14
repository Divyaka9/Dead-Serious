function CheckInCard({ lastCheckIn = 'Not checked in yet', onCheckIn, disabled = false }) {
  return (
    <article className="panel">
      <h3>Check-In</h3>
      <p>Last check-in: {lastCheckIn ? new Date(lastCheckIn).toLocaleString() : 'Not checked in yet'}</p>
      <button className="btn" type="button" onClick={onCheckIn} disabled={disabled}>
        Check In Now
      </button>
    </article>
  )
}

export default CheckInCard
