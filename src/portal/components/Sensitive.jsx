// Envuelve contenido privado (fotos, nombres de tratamientos, productos, notas).
// Con el modo discreto activo se desenfoca al instante vía CSS.
export default function Sensitive({ as: Tag = 'span', media = false, className = '', children, ...rest }) {
  return (
    <Tag className={`sensitive${media ? ' sensitive--media' : ''} ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  );
}
