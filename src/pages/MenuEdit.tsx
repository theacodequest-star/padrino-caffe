import { useState, type FormEvent } from 'react'
import { Page } from '../components/Page'
import { Field } from '../components/Field'
import { Loading } from '../components/Loading'
import { Sheet } from '../components/Sheet'
import { useDialog } from '../components/Dialog'
import { api, type Category, type MenuItem } from '../lib/api'
import { useI18n } from '../lib/i18n'
import { pick, rsd } from '../lib/guest'
import { useLoad } from '../lib/useLoad'

type Editing = { kind: 'category'; row: Partial<Category> } | { kind: 'item'; row: Partial<MenuItem> } | null

export function MenuEdit() {
  const { t, lang } = useI18n()
  const dialog = useDialog()
  const menu = useLoad(() => api.menu())
  const [editing, setEditing] = useState<Editing>(null)

  if (!menu.data) return <Page title={t('editMenu')}><Loading error={menu.error} /></Page>
  const { categories, items } = menu.data

  const run = async (fn: () => Promise<void>) => {
    try { await fn() } catch { dialog({ message: t('error') }) }
    menu.reload()
  }

  const removeItem = async (i: MenuItem) => {
    if (await dialog({ message: t('deleteItemConfirm', { n: pick(i, 'name', lang) }), confirm: true, okLabel: t('delete'), danger: true }))
      run(() => api.deleteItem(i.id))
  }
  const removeCategory = async (c: Category) => {
    if (await dialog({ message: t('deleteCategoryConfirm', { n: pick(c, 'name', lang) }), confirm: true, okLabel: t('delete'), danger: true }))
      run(() => api.deleteCategory(c.id))
  }

  return (
    <Page title={t('editMenu')}>
      <button className="btn btn-ghost" onClick={() => setEditing({ kind: 'category', row: { sort_order: categories.length + 1 } })}>
        + {t('newCategory')}
      </button>

      {categories.map(c => (
        <section key={c.id} className="edit-cat">
          <div className="edit-cat-head">
            <h2 className="section-title">{pick(c, 'name', lang)}</h2>
            <div className="row-actions">
              <button className="link-btn" onClick={() => setEditing({ kind: 'category', row: c })}>{t('edit')}</button>
              <button className="link-btn danger" onClick={() => removeCategory(c)}>{t('delete')}</button>
            </div>
          </div>
          <ul className="list">
            {items.filter(i => i.category_id === c.id).map(i => (
              <li key={i.id} className="list-row edit-row">
                <div className="edit-row-main">
                  <span className={i.available ? '' : 'muted'}>{pick(i, 'name', lang)}</span>
                  <span className="price">{rsd(i.price)}</span>
                </div>
                <div className="edit-row-actions">
                  <label className="switch-toggle">
                    <input type="checkbox" role="switch" checked={i.available} onChange={e => run(() => api.setAvailable(i.id, e.target.checked))} />
                    <span>{i.available ? t('availableToday') : t('unavailable')}</span>
                  </label>
                  <button className="link-btn" onClick={() => setEditing({ kind: 'item', row: i })}>{t('edit')}</button>
                  <button className="link-btn danger" onClick={() => removeItem(i)}>{t('delete')}</button>
                </div>
              </li>
            ))}
          </ul>
          <button className="btn btn-ghost btn-small add-item" onClick={() =>
            setEditing({ kind: 'item', row: { category_id: c.id, available: true, sort_order: items.filter(i => i.category_id === c.id).length + 1 } })}>
            + {t('newItem')}
          </button>
        </section>
      ))}

      {editing?.kind === 'category' && (
        <CategoryForm row={editing.row} onClose={() => setEditing(null)} onSave={r => run(() => api.saveCategory(r)).then(() => setEditing(null))} />
      )}
      {editing?.kind === 'item' && (
        <ItemForm row={editing.row} categories={categories} onClose={() => setEditing(null)}
          onSave={r => run(() => api.saveItem(r)).then(() => setEditing(null))} />
      )}
    </Page>
  )
}

function CategoryForm({ row, onClose, onSave }: { row: Partial<Category>; onClose: () => void; onSave: (r: Partial<Category>) => void }) {
  const { t } = useI18n()
  const [f, setF] = useState({ name_sr: row.name_sr ?? '', name_en: row.name_en ?? '', sort_order: String(row.sort_order ?? 1) })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSave({ ...(row.id ? { id: row.id } : {}), name_sr: f.name_sr.trim(), name_en: f.name_en.trim(), sort_order: Number(f.sort_order) || 0 })
  }
  return (
    <Sheet onClose={onClose} label={row.id ? t('edit') : t('newCategory')}>
      <form onSubmit={submit}>
        <h2 className="section-title" style={{ marginTop: 0 }}>{row.id ? t('edit') : t('newCategory')}</h2>
        <Field label={t('nameSr')} name="name_sr" required value={f.name_sr} onChange={e => setF({ ...f, name_sr: e.target.value })} />
        <Field label={t('nameEn')} name="name_en" required value={f.name_en} onChange={e => setF({ ...f, name_en: e.target.value })} />
        <Field label={t('sortOrder')} name="sort_order" inputMode="numeric" value={f.sort_order} onChange={e => setF({ ...f, sort_order: e.target.value.replace(/\D/g, '') })} />
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
          <button className="btn">{t('save')}</button>
        </div>
      </form>
    </Sheet>
  )
}

function ItemForm({ row, categories, onClose, onSave }: {
  row: Partial<MenuItem>; categories: Category[]; onClose: () => void; onSave: (r: Partial<MenuItem>) => void
}) {
  const { t, lang } = useI18n()
  const [f, setF] = useState({
    category_id: row.category_id ?? categories[0]?.id ?? '',
    name_sr: row.name_sr ?? '', name_en: row.name_en ?? '',
    description_sr: row.description_sr ?? '', description_en: row.description_en ?? '',
    price: row.price ? String(row.price) : '', sort_order: String(row.sort_order ?? 1), available: row.available ?? true,
  })
  const set = (k: keyof typeof f) => (v: string | boolean) => setF({ ...f, [k]: v })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSave({
      ...(row.id ? { id: row.id } : {}), category_id: f.category_id, name_sr: f.name_sr.trim(), name_en: f.name_en.trim(),
      description_sr: f.description_sr.trim() || null, description_en: f.description_en.trim() || null,
      price: Number(f.price), sort_order: Number(f.sort_order) || 0, available: f.available,
    })
  }
  return (
    <Sheet onClose={onClose} label={row.id ? t('edit') : t('newItem')}>
      <form onSubmit={submit}>
        <h2 className="section-title" style={{ marginTop: 0 }}>{row.id ? t('edit') : t('newItem')}</h2>
        <label className="field">
          <span className="field-label">{t('category')}</span>
          <select value={f.category_id} onChange={e => set('category_id')(e.target.value)}>
            {categories.map(c => <option key={c.id} value={c.id}>{pick(c, 'name', lang)}</option>)}
          </select>
        </label>
        <Field label={t('nameSr')} name="name_sr" required value={f.name_sr} onChange={e => set('name_sr')(e.target.value)} />
        <Field label={t('nameEn')} name="name_en" required value={f.name_en} onChange={e => set('name_en')(e.target.value)} />
        <Field label={t('descSr')} name="description_sr" value={f.description_sr} onChange={e => set('description_sr')(e.target.value)} />
        <Field label={t('descEn')} name="description_en" value={f.description_en} onChange={e => set('description_en')(e.target.value)} />
        <Field label={t('priceRsd')} name="price" required inputMode="numeric" value={f.price} onChange={e => set('price')(e.target.value.replace(/\D/g, ''))} />
        <Field label={t('sortOrder')} name="sort_order" inputMode="numeric" value={f.sort_order} onChange={e => set('sort_order')(e.target.value.replace(/\D/g, ''))} />
        <label className="switch-toggle">
          <input type="checkbox" role="switch" checked={f.available} onChange={e => set('available')(e.target.checked)} />
          <span>{f.available ? t('availableToday') : t('unavailable')}</span>
        </label>
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
          <button className="btn" disabled={!f.price || !f.category_id}>{t('save')}</button>
        </div>
      </form>
    </Sheet>
  )
}
