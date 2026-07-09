from setuptools import setup, find_packages

setup(
    name=\'trust_engine\',
    version=\'0.1.0\',
    packages=find_packages(),
    install_requires=[
        # Adicione aqui quaisquer dependências que o trust_engine possa ter
    ],
    author=\'Project-X\',
    author_email=\'sprint@project-x.ai\',
    description=\'Motor de Confiança para o LifeOS, garantindo transparência e auditabilidade.\',
    long_description=open(\'README.md\').read(),
    long_description_content_type=\'text/markdown\',
    url=\'https://github.com/al6387838-sys/Project-X/trust_engine\',
    classifiers=[
        \'Programming Language :: Python :: 3\',
        \'License :: OSI Approved :: MIT License\',
        \'Operating System :: OS Independent\',
    ],
    python_requires=\'>=3.8\',
)
