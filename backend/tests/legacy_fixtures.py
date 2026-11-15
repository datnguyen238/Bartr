"""Create pre-policy listings for tests of legacy trade and migration behavior."""


def seed_legacy_available(app, actor, facts):
    item = app.save_item(actor, None, None, {**facts, 'status': 'draft'})
    def mark_legacy(state):
        state['items'][item['id']]['status'] = 'available'
        return dict(state['items'][item['id']])
    return app.repo.mutate(mark_legacy)
