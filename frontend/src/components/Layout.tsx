import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { user, logout } = useAuth()

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">CRM</div>
        <nav className="sidebar-nav">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/pipeline"
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            Pipeline
          </NavLink>
          <NavLink
            to="/clients"
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            Clients
          </NavLink>
          <NavLink
            to="/leads"
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            Leads
          </NavLink>
          <NavLink
            to="/projects"
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            Projects
          </NavLink>
          <NavLink
            to="/transactions"
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            Transactions
          </NavLink>
          <NavLink
            to="/invoices"
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            Invoices
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <span className="user-name">{user?.full_name}</span>
          <button type="button" onClick={logout}>
            Logout
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
