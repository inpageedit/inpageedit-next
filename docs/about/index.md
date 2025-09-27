<script setup>
import { VPTeamMembers } from 'vitepress/theme'

const coreTeam = [
  {
    avatar: 'https://www.github.com/dragon-fish.png',
    name: 'Dragon Fish',
    title: '原作者',
    links: [
      { icon: 'github', link: 'https://github.com/dragon-fish' },
      { icon: 'twitter', link: 'https://twitter.com/xiaoyujundesu' }
    ]
  },
]

const contributors = [
  {
    avatar: 'https://www.github.com/bhsd-harry.png',
    name: 'Bhsd',
    title: '插件开发者',
  },
  {
    avatar: 'https://www.github.com/Dianliang233.png',
    name: '电量',
    title: 'Logo 设计者',
  },
  {
    avatar: 'https://www.github.com/lovelyCARDINAL.png',
    name: '星海子',
    title: '开源贡献者',
  },
  {
    avatar: 'https://www.github.com/AlPha5130.png',
    name: 'NekoCharm',
    title: '插件开发者',
  },
]

const communityMembers = [
]
</script>

# 关于我们

认识一下 IPE 的开发者 & 贡献者们！

## 核心团队 Core Team

<VPTeamMembers size="small" :members="coreTeam" />

## 社区贡献者 Contributors

<VPTeamMembers size="small" :members="contributors" />

[查看全部贡献者](https://github.com/inpageedit/inpageedit-next/graphs/contributors)

## 社区成员 Community Members

<VPTeamMembers size="small" :members="communityMembers" />

[加入QQ群](https://qm.qq.com/q/Kpk147N8E8)
