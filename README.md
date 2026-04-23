

# ROMbay

将ROM的SQL数据加载到RAM同时做好安全审计的实验项目

## 项目简介

ROMbay 是一个实验性的 MySQL 数据库代理系统，主要实现以下功能：

- **SQL 缓存**：将 MySQL 查询结果缓存在内存（RAM）中，提高查询性能
- **安全审计**：记录和审计所有 SQL 操作，包括读写分离检测
- **用户认证**：实现 MySQL 协议的用户身份验证
- **权限控制**：基于表级别的细粒度权限控制

## 核心模块

### 1. LinkUPsql (src/LinkUPsql.js)
MySQL 协议代理层，支持：
- LRU 缓存策略
- SQL 语句分析（读写判断）
- 表级别缓存清除
- MySQL 协议数据包构建

### 2. LinkVMUser (src/LinkVMUser.js)
用户认证与权限管理：
- MySQL 握手协议实现
- 密码哈希验证
- 基于表的用户权限检查
- 默认用户初始化

### 3. DidHistory (src/DidHistory.js)
SQL 执行历史与审计：
- SQL 语句记录
- 只读/写操作判断
- 统计信息输出
- 缓存命中率统计

### 4. RomFromer (src/RomFromer.js)
ROM 数据监听服务：
- 网络数据包解析
- 用户名/密码提取
- MySQL 协议握手

## 快速开始

### 安装依赖

```bash
npm install
```

### 配置

编辑 `config.json` 配置文件：

```json
{
  "proxy": {
    "host": "127.0.0.1",
    "port": 3307
  },
  "backend": {
    "host": "127.0.0.1",
    "port": 3306,
    "user": "root",
    "password": "your_password",
    "database": "test"
  },
  "cache": {
    "maxSize": 1000
  }
}
```

### 运行

```bash
node index.js
```

## 测试

### 权限测试

```bash
node test_permission.js
```

### 性能测试

```bash
node test_qps.js
```

### 缓存命中率测试

```bash
node compare_perf.js
```

### 单表隔离测试

```bash
node test_single_table.js
```

## 项目结构

```
ROMbay/
├── src/
│   ├── DidHistory.js       # SQL审计日志
│   ├── LinkUPsql.js        # SQL代理与缓存
│   ├── LinkVMUser.js       # 用户认证与权限
│   ├── ReadConfig.js      # 配置读取
│   └── RomFromer.js        # ROM监听服务
├── index.js                # 主入口
├── config.json             # 配置文件
├── test_*.js               # 测试文件
└── create_*.js             # 工具脚本
```

## 主要特性

1. **内存缓存**：将频繁查询的 SQL 结果缓存到内存，减少数据库压力
2. **智能缓存**：根据 SQL 语句特征自动判断缓存键
3. **读写分离**：自动区分读操作和写操作，写操作后清除相关缓存
4. **安全审计**：记录所有 SQL 执行历史，便于安全分析
5. **用户隔离**：支持多用户独立权限控制

## 技术栈

- Node.js
- MySQL 协议
- LRU 缓存算法

## 注意事项

- 本项目为实验性项目，生产环境请谨慎使用
- 建议在测试环境中充分测试后再部署
