function CheckInCard({ lastCheckIn = 'Not checked in yet', onCheckIn }) {
  return (
    <article>
      <h3>Check-In</h3>
      <p>Last check-in: {lastCheckIn}</p>
      <button type="button" onClick={onCheckIn}>
        Check In Now
      </button>
    </article>
  )
}

export default CheckInCard
