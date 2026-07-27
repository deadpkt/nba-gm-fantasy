const player = (id, name, position, team, overall, points, rebounds, assists, color) => ({
  id, name, position, team, overall, stats: { points, rebounds, assists }, color,
  image: `https://cdn.nba.com/headshots/nba/latest/1040x760/${id}.png`,
})

const players = [
  player(1628983, 'Shai Gilgeous-Alexander', 'PG', 'OKC', 96, 32.7, 5.0, 6.4, '#ef9d27'),
  player(203999, 'Nikola Jokić', 'C', 'DEN', 98, 29.6, 12.7, 10.2, '#efb136'),
  player(1628369, 'Jayson Tatum', 'SF', 'BOS', 95, 26.8, 8.7, 6.0, '#18a66a'),
  player(203507, 'Giannis Antetokounmpo', 'PF', 'MIL', 97, 30.4, 11.9, 6.5, '#2daa65'),
  player(1630162, 'Anthony Edwards', 'SG', 'MIN', 93, 27.6, 5.7, 4.5, '#2b9ccf'),
  player(1641705, 'Victor Wembanyama', 'C', 'SAS', 95, 24.3, 11.0, 3.7, '#b1b2b6'),
  player(1629029, 'Luka Dončić', 'PG', 'LAL', 97, 28.2, 8.1, 7.8, '#8169d9'),
  player(201939, 'Stephen Curry', 'PG', 'GSW', 94, 24.5, 4.4, 6.0, '#e7b22e'),
  player(2544, 'LeBron James', 'SF', 'LAL', 95, 24.4, 7.8, 8.2, '#6e59c9'),
  player(201142, 'Kevin Durant', 'PF', 'PHX', 94, 26.6, 6.0, 4.2, '#e45a42'),
  player(1628378, 'Donovan Mitchell', 'SG', 'CLE', 91, 24.0, 4.5, 5.0, '#9d3c4d'),
  player(1629630, 'Ja Morant', 'PG', 'MEM', 91, 23.2, 4.1, 7.3, '#58b9db'),
  player(1629027, 'Trae Young', 'PG', 'ATL', 90, 24.2, 3.1, 11.6, '#dc5260'),
  player(1630169, 'Tyrese Haliburton', 'PG', 'IND', 91, 18.6, 3.5, 9.2, '#e6c23c'),
  player(203076, 'Anthony Davis', 'C', 'LAL', 93, 24.7, 11.6, 3.5, '#7756be'),
  player(1626164, 'Devin Booker', 'SG', 'PHX', 92, 25.6, 4.1, 6.8, '#e55b38'),
  player(1628973, 'Jalen Brunson', 'PG', 'NYK', 92, 26.0, 3.0, 7.3, '#e36b3c'),
  player(1626157, 'Karl-Anthony Towns', 'C', 'NYK', 90, 24.4, 12.8, 3.1, '#e36b3c'),
  player(1631094, 'Paolo Banchero', 'PF', 'ORL', 89, 25.9, 7.5, 4.8, '#2f9ed0'),
  player(1630595, 'Cade Cunningham', 'PG', 'DET', 89, 26.1, 6.1, 9.1, '#d64f4c'),
  player(1629627, 'Zion Williamson', 'PF', 'NOP', 89, 24.6, 7.2, 5.3, '#d84356'),
  player(1631114, 'Jalen Williams', 'SF', 'OKC', 89, 21.6, 5.3, 5.1, '#e2a12a'),
  player(1627734, 'Domantas Sabonis', 'C', 'SAC', 90, 19.1, 14.0, 6.0, '#7557b7'),
  player(1628389, 'Bam Adebayo', 'C', 'MIA', 88, 19.3, 10.4, 4.3, '#dc4d52'),
  player(202681, 'Kyrie Irving', 'PG', 'DAL', 91, 24.7, 4.8, 4.6, '#3976c0'),
  player(1627759, 'Jaylen Brown', 'SG', 'BOS', 91, 22.2, 5.8, 4.5, '#1d9a64'),
  player(1630567, 'Scottie Barnes', 'SF', 'TOR', 88, 19.3, 7.7, 5.9, '#cc4251'),
  player(1630532, 'Franz Wagner', 'SF', 'ORL', 87, 24.2, 5.7, 4.7, '#287fb1'),
  player(1630596, 'Evan Mobley', 'PF', 'CLE', 88, 18.5, 9.3, 3.2, '#9d3c4d'),
  player(1627750, 'Jamal Murray', 'PG', 'DEN', 89, 21.4, 3.8, 6.0, '#eab348'),
]

export default players
