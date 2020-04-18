const { name } = require('faker')
const { parse } = require('uuid-parse')

module.exports = async (dbPool, player, resourceName, ...permissionNames) => {
  const roleName = name.firstName()
  const playerId = Buffer.isBuffer(player.id) ? player.id : parse(player.id, Buffer.alloc(16))
  let roleId

  try {
    await dbPool.transaction(async trx => {
      const [insertId] = await trx('bm_web_roles').insert({ name: roleName, parent_role_id: 1 }, ['id'])
      const [resource] = await dbPool('bm_web_resources').select('resource_id AS id').where('name', resourceName)
      const permissions = await dbPool('bm_web_resource_permissions').select('permission_id', 'name', 'value').where('resource_id', resource.id)
      let value = 0

      for (const permission of permissions) {
        if (permissionNames.includes(permission.name)) value += permission.value
      }

      await trx('bm_web_role_resources').insert({ value, role_id: insertId, resource_id: resource.id })
      await trx('bm_web_player_roles').insert({ player_id: playerId, role_id: insertId })

      await trx.commit()

      roleId = insertId
    })
  } catch (e) {
    console.error(e)
  }

  if (!roleId) throw new Error('Failed to create role')

  return {
    async reset () {
      await dbPool('bm_web_role_resources').where({ role_id: roleId }).del()
      await dbPool('bm_web_player_roles').where({ player_id: playerId, role_id: roleId }).del()
      await dbPool('bm_web_roles').where({ role_id: roleId }).del()
    }
  }
}
