from app.utils.validators import (
    has_valid_cep_length,
    has_valid_process_cnj_length,
    is_disposable_email,
    is_valid_cnpj,
    is_valid_cpf,
    only_digits,
)


def test_only_digits():
    assert only_digits("123.456.789-09") == "12345678909"
    assert only_digits("12.345.678/0001-95") == "12345678000195"


def test_is_valid_cpf():
    assert is_valid_cpf("529.982.247-25")
    assert is_valid_cpf("111.444.777-35")
    assert not is_valid_cpf("111.111.111-11")
    assert not is_valid_cpf("529.982.247-24")


def test_is_valid_cnpj():
    assert is_valid_cnpj("04.252.011/0001-10")
    assert is_valid_cnpj("11.222.333/0001-81")
    assert not is_valid_cnpj("00.000.000/0000-00")
    assert not is_valid_cnpj("04.252.011/0001-11")


def test_is_disposable_email():
    assert is_disposable_email("test@mailinator.com")
    assert is_disposable_email("test@sub.mailinator.com")
    assert is_disposable_email("test@10minutemail.com")
    assert not is_disposable_email("test@gmail.com")


def test_length_helpers_for_cep_and_cnj():
    assert has_valid_cep_length("01310-100")
    assert not has_valid_cep_length("01310-10")

    assert has_valid_process_cnj_length("00012345620258160000")
    assert not has_valid_process_cnj_length("0001234562025816000")
