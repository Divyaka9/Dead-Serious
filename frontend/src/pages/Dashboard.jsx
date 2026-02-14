import CheckInCard from '../components/CheckInCard'
import ApprovalStatus from '../components/ApprovalStatus'

function Dashboard() {
  return (
    <section>
      <h2>Dashboard</h2>
      <p>Track vault activity and current unlock status.</p>
      <CheckInCard />
      <ApprovalStatus />
    </section>
  )
}

export default Dashboard
