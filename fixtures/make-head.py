"""Derives the `head` fixture sets from `base` by applying a fixed list of schema changes.

Run from the repo root: python fixtures/make-head.py
Changes applied (both formats):
  - Block List Hero: second block added, label changed, max raised to 2
  - Toggle: renamed to "Yes/No Toggle" (uSync: new file + Rename tombstone)
  - Legacy Dropdown: deleted (uSync: Delete tombstone, Deploy: file removed)
  - landingPage: intro made mandatory, size removed, ctaLabel added in a new "Call to action" group
  - quoteBlock: new element type
"""
import json
import os
import re
import shutil

ROOT = os.path.dirname(os.path.abspath(__file__))


def read(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


def write(p, s):
    with open(p, 'w', encoding='utf-8', newline='\n') as f:
        f.write(s)


def usync():
    base = os.path.join(ROOT, 'usync', 'base')
    head = os.path.join(ROOT, 'usync', 'head')
    shutil.rmtree(head, ignore_errors=True)
    shutil.copytree(base, head)
    os.chdir(os.path.join(head, 'uSync', 'v17'))

    p = 'DataTypes/BlockListHero.config'
    s = read(p)
    s = s.replace(
        '"label": "Hero: {=title}"\n    }',
        '"label": "Hero: {=title} ({=subtitle})"\n    },\n    {\n'
        '      "contentElementTypeKey": "9531ac35-3f0c-44e7-a8ae-dc6f93d2d752",\n      "label": "Quote"\n    }',
    )
    s = s.replace('"max": 1', '"max": 2')
    write(p, s)

    s = read('DataTypes/Toggle.config')
    s = s.replace('<Name>Toggle</Name>', '<Name>Yes/No Toggle</Name>').replace('Alias="Toggle"', 'Alias="Yes/No Toggle"')
    write('DataTypes/YesNoToggle.config', s)
    write('DataTypes/Toggle.config',
          '<?xml version="1.0" encoding="utf-8"?>\n<Empty Key="92897bc6-a5f3-4ffe-ae27-f2e7e33dda49" Alias="Toggle" Change="Rename" />\n')
    write('DataTypes/LegacyDropdown.config',
          '<?xml version="1.0" encoding="utf-8"?>\n<Empty Key="5a1d7b2e-3c4f-4e5a-9b6c-7d8e9f0a1b2c" Alias="Legacy Dropdown" Change="Delete" />\n')

    p = 'ContentTypes/landingpage.config'
    s = read(p)
    s = s.replace(
        '<Alias>intro</Alias>\n      <Definition>c6bac0dd-4ab9-45b1-8e30-e4b619ee5da3</Definition>\n'
        '      <Type>Umbraco.TextArea</Type>\n      <Mandatory>false</Mandatory>',
        '<Alias>intro</Alias>\n      <Definition>c6bac0dd-4ab9-45b1-8e30-e4b619ee5da3</Definition>\n'
        '      <Type>Umbraco.TextArea</Type>\n      <Mandatory>true</Mandatory>',
    )
    s = re.sub(r'    <GenericProperty>\s*<Key>3d000000-0001-4a00-8000-000000000004</Key>.*?</GenericProperty>\n', '', s, flags=re.S)
    s = s.replace('  </GenericProperties>', '''    <GenericProperty>
      <Key>3d000000-0001-4a00-8000-000000000005</Key>
      <Name>Call To Action Label</Name>
      <Alias>ctaLabel</Alias>
      <Definition>0cc0eba1-9960-42c9-bf9b-60e150b429ae</Definition>
      <Type>Umbraco.TextBox</Type>
      <Mandatory>false</Mandatory>
      <Validation>^.{0,40}$</Validation>
      <Description><![CDATA[Max 40 characters]]></Description>
      <SortOrder>0</SortOrder>
      <Tab Alias="content/cta">Call to action</Tab>
      <Variations>Nothing</Variations>
      <MandatoryMessage></MandatoryMessage>
      <ValidationRegExpMessage>Keep it under 40 characters</ValidationRegExpMessage>
      <LabelOnTop>true</LabelOnTop>
    </GenericProperty>
  </GenericProperties>''')
    s = s.replace('  </Tabs>', '''    <Tab>
      <Key>3e000000-0001-4a00-8000-000000000004</Key>
      <Caption>Call to action</Caption>
      <Alias>content/cta</Alias>
      <Type>Group</Type>
      <SortOrder>1</SortOrder>
    </Tab>
  </Tabs>''')
    write(p, s)

    q = read('ContentTypes/heroblock.config')
    for a, b in [
        ('4f92f906-0a1b-4c2d-9e3f-a4b5c6d7e8f9', '9531ac35-3f0c-44e7-a8ae-dc6f93d2d752'),
        ('Alias="heroBlock"', 'Alias="quoteBlock"'),
        ('<Name>Hero Block</Name>', '<Name>Quote Block</Name>'),
        ('icon-picture color-blue', 'icon-quote color-black'),
        ('1552cf3a-0001-4a00-8000-000000000001', '1552cf3a-0002-4a00-8000-000000000001'),
        ('808d1326-0001-4a00-8000-000000000001', '808d1326-0002-4a00-8000-000000000001'),
        ('<Name>Title</Name>', '<Name>Quote</Name>'),
        ('<Alias>title</Alias>', '<Alias>quote</Alias>'),
    ]:
        q = q.replace(a, b)
    write('ContentTypes/quoteblock.config', q)


def n(guid):
    return guid.replace('-', '')


def deploy():
    base = os.path.join(ROOT, 'deploy', 'base', 'umbraco', 'Deploy', 'Revision')
    head = os.path.join(ROOT, 'deploy', 'head', 'umbraco', 'Deploy', 'Revision')
    shutil.rmtree(os.path.join(ROOT, 'deploy', 'head'), ignore_errors=True)
    shutil.copytree(base, head)

    def load(name):
        return json.loads(read(os.path.join(head, name)))

    def save(name, obj):
        write(os.path.join(head, name), json.dumps(obj, indent=2) + '\n')

    bl = 'data-type__3726dfae1b2c4d3e8f4a5b6c7d8e9f01.uda'
    d = load(bl)
    d['Configuration']['blocks'][0]['label'] = 'Hero: {=title} ({=subtitle})'
    d['Configuration']['blocks'].append({'contentElementTypeKey': '9531ac35-3f0c-44e7-a8ae-dc6f93d2d752', 'label': 'Quote'})
    d['Configuration']['validationLimit']['max'] = 2
    d['Dependencies'].append({'Udi': 'umb://document-type/' + n('9531ac35-3f0c-44e7-a8ae-dc6f93d2d752')})
    save(bl, d)

    tg = 'data-type__92897bc6a5f34ffeae27f2e7e33dda49.uda'
    d = load(tg)
    d['Name'] = 'Yes/No Toggle'
    save(tg, d)

    os.remove(os.path.join(head, 'data-type__5a1d7b2e3c4f4e5a9b6c7d8e9f0a1b2c.uda'))

    lp = 'document-type__102e9699044e45ff9d099f9d636ec6f9.uda'
    d = load(lp)
    groups = {g['Alias']: g for g in d['PropertyGroups']}
    for p in groups['content/hero']['PropertyTypes']:
        if p['Alias'] == 'intro':
            p['Mandatory'] = True
    groups['settings']['PropertyTypes'] = [p for p in groups['settings']['PropertyTypes'] if p['Alias'] != 'size']
    d['PropertyGroups'].append({
        'Key': '3e000000-0001-4a00-8000-000000000004', 'Name': 'Call to action', 'SortOrder': 1, 'Alias': 'content/cta',
        'PropertyTypes': [{
            'Key': '3d000000-0001-4a00-8000-000000000005', 'Alias': 'ctaLabel',
            'DataType': 'umb://data-type/' + n('0cc0eba1-9960-42c9-bf9b-60e150b429ae'), 'ValueType': 'System.String',
            'Name': 'Call To Action Label', 'Description': 'Max 40 characters', 'Validation': '^.{0,40}$',
            'ValidationMessage': 'Keep it under 40 characters', 'LabelOnTop': True,
        }],
    })
    save(lp, d)

    hb = load('document-type__4f92f9060a1b4c2d9e3fa4b5c6d7e8f9.uda')
    hb.update({'Name': 'Quote Block', 'Alias': 'quoteBlock', 'Icon': 'icon-quote color-black',
               'Udi': 'umb://document-type/' + n('9531ac35-3f0c-44e7-a8ae-dc6f93d2d752')})
    hb['PropertyGroups'][0]['Key'] = '808d1326-0002-4a00-8000-000000000001'
    pt = hb['PropertyGroups'][0]['PropertyTypes'][0]
    pt.update({'Key': '1552cf3a-0002-4a00-8000-000000000001', 'Alias': 'quote', 'Name': 'Quote'})
    save('document-type__9531ac353f0c44e7a8aedc6f93d2d752.uda', hb)


if __name__ == '__main__':
    usync()
    deploy()
    print('head fixtures regenerated')
