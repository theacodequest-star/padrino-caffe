import logo from '../logo.svg'

export function Logo({ className = '' }: { className?: string }) {
  return <img src={logo} alt="Caffe Padrino" className={`logo ${className}`} />
}
