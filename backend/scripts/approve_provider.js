const readline = require('readline');
const { Provider, User, sequelize } = require('../src/models/index');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function main() {
  try {
    console.log('=== GREENSTEPS TERMINAL PROVIDER APPROVER ===');
    console.log('Connecting to database...');
    await sequelize.authenticate();
    
    // 1. Query pending provider registrations
    const pendingProviders = await Provider.findAll({
      where: {
        provider_status: 'pending'
      },
      order: [['createdAt', 'ASC']]
    });

    if (pendingProviders.length === 0) {
      console.log('\n[Thông báo] Không có nhà cung cấp (NCC) nào đang chờ duyệt.');
      rl.close();
      process.exit(0);
    }

    console.log(`\nTìm thấy ${pendingProviders.length} yêu cầu đăng ký nhà cung cấp đang chờ duyệt:\n`);
    
    // Display list
    for (let i = 0; i < pendingProviders.length; i++) {
      const prov = pendingProviders[i];
      console.log(`[${i + 1}] ID đối tác: ${prov.id}`);
      console.log(`    - Tên nhà cung cấp: ${prov.name_provider}`);
      console.log(`    - Lĩnh vực hoạt động: ${prov.field}`);
      console.log(`    - Địa điểm đăng ký: ${prov.destination}`);
      console.log(`    - Thời gian yêu cầu: ${new Date(prov.createdAt).toLocaleString('vi-VN')}`);
      console.log('--------------------------------------------------');
    }

    // 2. Prompt user to approve
    rl.question('\nNhập ID đối tác bạn muốn duyệt (hoặc nhập "all" để duyệt tất cả, "exit" để thoát): ', async (answer) => {
      const cmd = answer.trim();
      
      if (cmd.toLowerCase() === 'exit') {
        console.log('Thoát chương trình.');
        rl.close();
        process.exit(0);
      }

      if (cmd.toLowerCase() === 'all') {
        console.log('\nĐang duyệt toàn bộ nhà cung cấp...');
        const t = await sequelize.transaction();
        try {
          for (const prov of pendingProviders) {
            prov.provider_status = 'active';
            await prov.save({ transaction: t });

            // Find the user with company_name or username matching name_provider
            // and update their role to 'provider'
            const user = await User.findOne({ 
              where: { 
                [sequelize.Sequelize.Op.or]: [
                  { company_name: prov.name_provider },
                  { username: prov.name_provider }
                ]
              },
              transaction: t 
            });

            if (user) {
              user.role = 'provider';
              await user.save({ transaction: t });
              console.log(`- Đã cập nhật role 'provider' cho tài khoản: ${user.username}`);
            }
          }
          await t.commit();
          console.log('[Thành công] Đã duyệt toàn bộ nhà cung cấp thành công!');
        } catch (err) {
          await t.rollback();
          console.error('[Thất bại] Lỗi duyệt gộp NCC:', err.message);
        }
      } else {
        // Find single provider
        const targetProv = pendingProviders.find(p => p.id === cmd);
        if (!targetProv) {
          console.log('[Lỗi] Không tìm thấy ID đối tác phù hợp trong danh sách chờ duyệt!');
        } else {
          const t = await sequelize.transaction();
          try {
            targetProv.provider_status = 'active';
            await targetProv.save({ transaction: t });

            // Find user and upgrade role
            const user = await User.findOne({ 
              where: { 
                [sequelize.Sequelize.Op.or]: [
                  { company_name: targetProv.name_provider },
                  { username: targetProv.name_provider }
                ]
              },
              transaction: t 
            });

            if (user) {
              user.role = 'provider';
              await user.save({ transaction: t });
              console.log(`- Đã nâng cấp tài khoản ${user.username} lên vai trò Đối tác.`);
            }

            await t.commit();
            console.log(`\n[Thành công] Nhà cung cấp "${targetProv.name_provider}" đã hoạt động chính thức!`);
          } catch (err) {
            await t.rollback();
            console.error('[Thất bại] Lỗi duyệt nhà cung cấp:', err.message);
          }
        }
      }

      rl.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('Lỗi kết nối database:', error);
    rl.close();
    process.exit(1);
  }
}

main();
