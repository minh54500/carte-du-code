// Browser code.
export const users = () => fetch('/users');
export const post = (id) => fetch(`/posts/${id}`, { method: 'POST' });
export const evil = '</script><script>alert(1)</script>';
